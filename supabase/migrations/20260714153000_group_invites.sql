-- Pending email invites for groups (works even if invitee has no account yet)

CREATE TABLE IF NOT EXISTS public.group_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  email       text NOT NULL,
  invited_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  UNIQUE (group_id, email)
);

CREATE INDEX IF NOT EXISTS idx_group_invites_email ON public.group_invites(lower(email));
CREATE INDEX IF NOT EXISTS idx_group_invites_token ON public.group_invites(token);

ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

-- Members can view invites for their groups
CREATE POLICY "invites_select_member"
  ON public.group_invites FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

-- Members can create invites for their groups
CREATE POLICY "invites_insert_member"
  ON public.group_invites FOR INSERT TO authenticated
  WITH CHECK (
    public.is_group_member(group_id)
    AND invited_by = auth.uid()
  );

-- Accept pending invites for the current user's email
CREATE OR REPLACE FUNCTION public.accept_pending_invites_for_user()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_count integer := 0;
  inv record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN 0; END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = v_user_id;
  IF v_email IS NULL THEN RETURN 0; END IF;

  FOR inv IN
    SELECT id, group_id FROM public.group_invites
    WHERE lower(email) = lower(v_email)
      AND status = 'pending'
      AND expires_at > now()
  LOOP
    INSERT INTO public.group_members (group_id, user_id)
    VALUES (inv.group_id, v_user_id)
    ON CONFLICT DO NOTHING;

    UPDATE public.group_invites SET status = 'accepted' WHERE id = inv.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_pending_invites_for_user() TO authenticated;

-- Accept a single invite by token (for /join/[token] link)
CREATE OR REPLACE FUNCTION public.accept_group_invite(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  inv public.group_invites%ROWTYPE;
  gname text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = v_user_id;

  SELECT * INTO inv FROM public.group_invites
  WHERE token = p_token AND status = 'pending' AND expires_at > now();

  IF inv.id IS NULL THEN
    RAISE EXCEPTION 'Invite not found or expired';
  END IF;

  IF lower(v_email) <> lower(inv.email) THEN
    RAISE EXCEPTION 'This invite was sent to a different email address';
  END IF;

  INSERT INTO public.group_members (group_id, user_id)
  VALUES (inv.group_id, v_user_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.group_invites SET status = 'accepted' WHERE id = inv.id;

  SELECT name INTO gname FROM public.groups WHERE id = inv.group_id;

  RETURN json_build_object(
    'groupId', inv.group_id,
    'groupName', gname,
    'email', inv.email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_group_invite(text) TO authenticated;

-- Create invite RPC (returns token + link path)
CREATE OR REPLACE FUNCTION public.create_group_invite(p_group_id uuid, p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_invite public.group_invites%ROWTYPE;
  v_existing uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT public.is_group_member(p_group_id) THEN
    RAISE EXCEPTION 'You are not a member of this group';
  END IF;

  -- If user already exists, add directly
  SELECT id INTO v_existing FROM public.profiles WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_existing IS NOT NULL THEN
    INSERT INTO public.group_members (group_id, user_id)
    VALUES (p_group_id, v_existing)
    ON CONFLICT DO NOTHING;
    RETURN json_build_object('type', 'added', 'userId', v_existing);
  END IF;

  INSERT INTO public.group_invites (group_id, email, invited_by)
  VALUES (p_group_id, lower(trim(p_email)), v_user_id)
  ON CONFLICT (group_id, email) DO UPDATE
    SET token = encode(gen_random_bytes(24), 'hex'),
        status = 'pending',
        invited_by = v_user_id,
        expires_at = now() + interval '7 days',
        created_at = now()
  RETURNING * INTO v_invite;

  RETURN json_build_object(
    'type', 'invite',
    'token', v_invite.token,
    'email', v_invite.email,
    'expiresAt', v_invite.expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_group_invite(uuid, text) TO authenticated;

-- Public preview for invite link (no auth needed)
CREATE OR REPLACE FUNCTION public.get_invite_preview(p_token text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT json_build_object(
    'email', gi.email,
    'groupName', g.name,
    'status', gi.status,
    'expired', gi.expires_at < now()
  )
  FROM public.group_invites gi
  JOIN public.groups g ON g.id = gi.group_id
  WHERE gi.token = p_token;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_preview(text) TO anon, authenticated;

-- Auto-accept pending invites when profile is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  -- Add to groups they were invited to
  INSERT INTO public.group_members (group_id, user_id)
  SELECT gi.group_id, NEW.id
  FROM public.group_invites gi
  WHERE lower(gi.email) = lower(NEW.email)
    AND gi.status = 'pending'
    AND gi.expires_at > now()
  ON CONFLICT DO NOTHING;

  UPDATE public.group_invites
  SET status = 'accepted'
  WHERE lower(email) = lower(NEW.email)
    AND status = 'pending';

  RETURN NEW;
END;
$$;

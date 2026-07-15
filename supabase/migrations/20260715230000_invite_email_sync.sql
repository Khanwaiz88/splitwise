-- Match invites to auth email (not just profiles.email) and keep profile email in sync

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(trim(COALESCE(
    (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()),
    (SELECT u.email::text FROM auth.users u WHERE u.id = auth.uid()),
    ''
  )));
$$;

GRANT EXECUTE ON FUNCTION public.current_user_email() TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_profile public.profiles;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

  IF FOUND THEN
    IF v_email IS NOT NULL AND lower(trim(COALESCE(v_profile.email, ''))) <> lower(trim(v_email)) THEN
      UPDATE public.profiles
      SET email = v_email
      WHERE id = v_user_id
      RETURNING * INTO v_profile;
    END IF;
    RETURN v_profile;
  END IF;

  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    v_user_id,
    v_email,
    COALESCE(split_part(v_email, '@', 1), 'User')
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  END IF;

  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_pending_invites()
RETURNS TABLE (
  id uuid,
  group_id uuid,
  group_name text,
  invited_by uuid,
  inviter_name text,
  email text,
  token text,
  created_at timestamptz,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    gi.id,
    gi.group_id,
    g.name AS group_name,
    gi.invited_by,
    COALESCE(
      NULLIF(trim(p.display_name), ''),
      NULLIF(split_part(p.email, '@', 1), ''),
      'Someone'
    ) AS inviter_name,
    gi.email,
    gi.token,
    gi.created_at,
    gi.expires_at
  FROM public.group_invites gi
  JOIN public.groups g ON g.id = gi.group_id
  LEFT JOIN public.profiles p ON p.id = gi.invited_by
  WHERE gi.status = 'pending'
    AND gi.expires_at > now()
    AND lower(gi.email) = public.current_user_email()
  ORDER BY gi.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.accept_group_invite_by_id(p_invite_id uuid)
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

  v_email := public.current_user_email();
  IF v_email = '' THEN
    RAISE EXCEPTION 'Profile email not found';
  END IF;

  SELECT * INTO inv FROM public.group_invites
  WHERE id = p_invite_id
    AND status = 'pending'
    AND expires_at > now();

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

  INSERT INTO public.activity_log (group_id, user_id, description)
  VALUES (inv.group_id, v_user_id, 'joined the group via invite');

  SELECT name INTO gname FROM public.groups WHERE id = inv.group_id;

  RETURN json_build_object(
    'groupId', inv.group_id,
    'groupName', gname,
    'email', inv.email
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_group_invite(p_invite_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  inv public.group_invites%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_email := public.current_user_email();
  IF v_email = '' THEN
    RAISE EXCEPTION 'Profile email not found';
  END IF;

  SELECT * INTO inv FROM public.group_invites
  WHERE id = p_invite_id AND status = 'pending';

  IF inv.id IS NULL THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF lower(v_email) <> lower(inv.email) THEN
    RAISE EXCEPTION 'This invite was sent to a different email address';
  END IF;

  UPDATE public.group_invites SET status = 'declined' WHERE id = inv.id;

  RETURN json_build_object('ok', true, 'inviteId', inv.id);
END;
$$;

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

  v_email := public.current_user_email();

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

DROP POLICY IF EXISTS "invites_select_invitee" ON public.group_invites;
CREATE POLICY "invites_select_invitee"
  ON public.group_invites FOR SELECT TO authenticated
  USING (lower(email) = public.current_user_email());

DROP POLICY IF EXISTS "invites_update_invitee" ON public.group_invites;
CREATE POLICY "invites_update_invitee"
  ON public.group_invites FOR UPDATE TO authenticated
  USING (
    lower(email) = public.current_user_email()
    AND status = 'pending'
  )
  WITH CHECK (lower(email) = public.current_user_email());

-- Backfill profile emails from auth
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND u.email IS NOT NULL
  AND (p.email IS NULL OR lower(trim(p.email)) <> lower(trim(u.email)));

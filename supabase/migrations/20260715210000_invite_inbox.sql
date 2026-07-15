-- In-app invite inbox: invitee can view/accept/decline + declined status

ALTER TABLE public.group_invites
  DROP CONSTRAINT IF EXISTS group_invites_status_check;

ALTER TABLE public.group_invites
  ADD CONSTRAINT group_invites_status_check
  CHECK (status IN ('pending', 'accepted', 'declined', 'expired'));

-- Invitee can read invites sent to their email
CREATE POLICY "invites_select_invitee"
  ON public.group_invites FOR SELECT TO authenticated
  USING (
    lower(email) = lower(
      COALESCE(
        (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()),
        ''
      )
    )
  );

-- Invitee can accept or decline their pending invites
CREATE POLICY "invites_update_invitee"
  ON public.group_invites FOR UPDATE TO authenticated
  USING (
    lower(email) = lower(
      COALESCE(
        (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()),
        ''
      )
    )
    AND status = 'pending'
  )
  WITH CHECK (
    lower(email) = lower(
      COALESCE(
        (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()),
        ''
      )
    )
  );

-- List pending invites for the logged-in user (in-app inbox)
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
    AND lower(gi.email) = lower(
      COALESCE(
        (SELECT pr.email FROM public.profiles pr WHERE pr.id = auth.uid()),
        ''
      )
    )
  ORDER BY gi.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_pending_invites() TO authenticated;

-- Accept invite from in-app inbox (by invite id)
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

  SELECT email INTO v_email FROM public.profiles WHERE id = v_user_id;
  IF v_email IS NULL THEN
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

GRANT EXECUTE ON FUNCTION public.accept_group_invite_by_id(uuid) TO authenticated;

-- Decline invite from in-app inbox
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

  SELECT email INTO v_email FROM public.profiles WHERE id = v_user_id;
  IF v_email IS NULL THEN
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

GRANT EXECUTE ON FUNCTION public.decline_group_invite(uuid) TO authenticated;

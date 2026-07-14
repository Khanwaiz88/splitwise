-- Fix group_invites: add UPDATE policy (needed for re-invites) + fix token generation in RPC

CREATE POLICY "invites_update_member"
  ON public.group_invites FOR UPDATE TO authenticated
  USING (public.is_group_member(group_id))
  WITH CHECK (public.is_group_member(group_id) AND invited_by = auth.uid());

-- Replace gen_random_bytes with gen_random_uuid (always available on Supabase)
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
  v_token text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT public.is_group_member(p_group_id) THEN
    RAISE EXCEPTION 'You are not a member of this group';
  END IF;

  SELECT id INTO v_existing FROM public.profiles WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_existing IS NOT NULL THEN
    INSERT INTO public.group_members (group_id, user_id)
    VALUES (p_group_id, v_existing)
    ON CONFLICT DO NOTHING;
    RETURN json_build_object('type', 'added', 'userId', v_existing);
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.group_invites (group_id, email, invited_by, token)
  VALUES (p_group_id, lower(trim(p_email)), v_user_id, v_token)
  ON CONFLICT (group_id, email) DO UPDATE
    SET token = EXCLUDED.token,
        status = 'pending',
        invited_by = v_user_id,
        expires_at = now() + interval '7 days'
  RETURNING * INTO v_invite;

  RETURN json_build_object(
    'type', 'invite',
    'token', v_invite.token,
    'email', v_invite.email,
    'expiresAt', v_invite.expires_at
  );
END;
$$;

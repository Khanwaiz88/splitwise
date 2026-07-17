-- Fixed shareable join link per group (same code for everyone)

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS join_code text;

UPDATE public.groups
SET join_code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
WHERE join_code IS NULL;

ALTER TABLE public.groups
  ALTER COLUMN join_code SET DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

ALTER TABLE public.groups
  ALTER COLUMN join_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_join_code ON public.groups(join_code);

CREATE OR REPLACE FUNCTION public.join_group_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_group public.groups%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT * INTO v_group FROM public.groups WHERE join_code = trim(p_code);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = v_group.id AND user_id = v_user
  ) THEN
    RETURN jsonb_build_object(
      'groupId', v_group.id,
      'groupName', v_group.name,
      'alreadyMember', true
    );
  END IF;

  INSERT INTO public.group_members (group_id, user_id)
  VALUES (v_group.id, v_user);

  INSERT INTO public.activity_log (group_id, user_id, description)
  VALUES (v_group.id, v_user, 'joined the group via share link');

  RETURN jsonb_build_object(
    'groupId', v_group.id,
    'groupName', v_group.name,
    'alreadyMember', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_group_by_code(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.preview_group_by_join_code(p_code text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object('groupId', id, 'groupName', name)
  FROM public.groups
  WHERE join_code = trim(p_code)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.preview_group_by_join_code(text) TO anon, authenticated;

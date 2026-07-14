-- Fetch all members for groups the current user belongs to (bypasses RLS gaps)

CREATE OR REPLACE FUNCTION public.get_groups_members(p_group_ids uuid[])
RETURNS TABLE (
  group_id uuid,
  user_id uuid,
  display_name text,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    gm.group_id,
    gm.user_id,
    COALESCE(
      NULLIF(trim(p.display_name), ''),
      NULLIF(split_part(p.email, '@', 1), ''),
      'Member'
    ) AS display_name,
    COALESCE(p.email, '') AS email
  FROM public.group_members gm
  LEFT JOIN public.profiles p ON p.id = gm.user_id
  WHERE gm.group_id = ANY(p_group_ids)
    AND public.is_group_member(gm.group_id)
  ORDER BY gm.group_id, display_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_groups_members(uuid[]) TO authenticated;

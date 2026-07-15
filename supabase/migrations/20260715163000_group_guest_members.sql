-- Guest members: added by display name only (no app account)

CREATE TABLE IF NOT EXISTS public.group_guest_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(trim(display_name)) >= 2),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_guest_members_name_unique
  ON public.group_guest_members (group_id, lower(trim(display_name)));

CREATE INDEX IF NOT EXISTS idx_group_guest_members_group_id
  ON public.group_guest_members (group_id);

-- Allow expense/settlement participant IDs to be guest UUIDs (not only auth.users)
ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_paid_by_fkey;

ALTER TABLE public.settlements
  DROP CONSTRAINT IF EXISTS settlements_from_user_fkey;

ALTER TABLE public.settlements
  DROP CONSTRAINT IF EXISTS settlements_to_user_fkey;

ALTER TABLE public.group_guest_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guest_members_select"
  ON public.group_guest_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "guest_members_insert"
  ON public.group_guest_members FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(group_id));

CREATE POLICY "guest_members_delete"
  ON public.group_guest_members FOR DELETE TO authenticated
  USING (public.is_group_member(group_id));

-- Include guest members in group member listings
DROP FUNCTION IF EXISTS public.get_groups_members(uuid[]);

CREATE OR REPLACE FUNCTION public.get_groups_members(p_group_ids uuid[])
RETURNS TABLE (
  group_id uuid,
  user_id uuid,
  display_name text,
  email text,
  is_guest boolean
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
    COALESCE(p.email, '') AS email,
    false AS is_guest
  FROM public.group_members gm
  LEFT JOIN public.profiles p ON p.id = gm.user_id
  WHERE gm.group_id = ANY(p_group_ids)
    AND public.is_group_member(gm.group_id)

  UNION ALL

  SELECT
    ggm.group_id,
    ggm.id AS user_id,
    trim(ggm.display_name) AS display_name,
    ''::text AS email,
    true AS is_guest
  FROM public.group_guest_members ggm
  WHERE ggm.group_id = ANY(p_group_ids)
    AND public.is_group_member(ggm.group_id)

  ORDER BY group_id, display_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_groups_members(uuid[]) TO authenticated;

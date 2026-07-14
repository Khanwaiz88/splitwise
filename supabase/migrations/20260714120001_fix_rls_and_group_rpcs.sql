-- Fix RLS infinite recursion + group RPC functions

-- ── Helper (SECURITY DEFINER breaks recursion loop) ───────────────────────
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = p_group_id
      AND user_id = auth.uid()
  );
$$;

-- ── RPC: fetch current user's groups ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_groups()
RETURNS TABLE (
  id uuid,
  name text,
  created_at timestamptz,
  member_count bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    g.id,
    g.name,
    g.created_at,
    COUNT(gm2.user_id)::bigint AS member_count
  FROM public.group_members gm
  JOIN public.groups g ON g.id = gm.group_id
  LEFT JOIN public.group_members gm2 ON gm2.group_id = g.id
  WHERE gm.user_id = auth.uid()
  GROUP BY g.id, g.name, g.created_at
  ORDER BY g.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_groups() TO authenticated;

-- ── RPC: create group + add creator as member ─────────────────────────────
CREATE OR REPLACE FUNCTION public.create_group_with_member(p_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.groups%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.groups (name)
  VALUES (trim(p_name))
  RETURNING * INTO v_group;

  INSERT INTO public.group_members (group_id, user_id)
  VALUES (v_group.id, auth.uid());

  RETURN json_build_object(
    'id', v_group.id,
    'name', v_group.name,
    'created_at', v_group.created_at,
    'memberCount', 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_group_with_member(text) TO authenticated;

-- ── Drop broken policies on groups & group_members ──────────────────────
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('group_members', 'groups')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- ── group_members policies (non-recursive) ────────────────────────────────
CREATE POLICY "gm_select_own"
  ON public.group_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "gm_select_same_group"
  ON public.group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "gm_insert_self"
  ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "gm_insert_invite"
  ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_group_member(group_id)
    AND user_id <> auth.uid()
  );

-- ── groups policies ───────────────────────────────────────────────────────
CREATE POLICY "groups_select_member"
  ON public.groups FOR SELECT TO authenticated
  USING (public.is_group_member(id));

CREATE POLICY "groups_insert_authenticated"
  ON public.groups FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "groups_update_member"
  ON public.groups FOR UPDATE TO authenticated
  USING (public.is_group_member(id))
  WITH CHECK (public.is_group_member(id));

-- ── profiles policies ─────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── expenses policies ─────────────────────────────────────────────────────
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expenses'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.expenses', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "expenses_select_member"
  ON public.expenses FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "expenses_insert_member"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(group_id));

-- ── activity_log policies ─────────────────────────────────────────────────
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'activity_log'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.activity_log', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "activity_select_member"
  ON public.activity_log FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "activity_insert_member"
  ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(group_id));

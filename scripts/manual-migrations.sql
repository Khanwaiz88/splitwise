-- Run this in Supabase Dashboard → SQL Editor if npm run db:push fails (IPv6/DNS issue)
-- Safe to run multiple times (uses IF NOT EXISTS / OR REPLACE where possible)

-- ── Settlements table (20260714190000) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settlements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  from_user   uuid NOT NULL REFERENCES auth.users(id),
  to_user     uuid NOT NULL REFERENCES auth.users(id),
  amount      numeric(12, 2) NOT NULL CHECK (amount > 0),
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (from_user <> to_user)
);

CREATE INDEX IF NOT EXISTS idx_settlements_group_id ON public.settlements(group_id);
CREATE INDEX IF NOT EXISTS idx_settlements_created_at ON public.settlements(group_id, created_at DESC);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "settlements_select_member"
    ON public.settlements FOR SELECT TO authenticated
    USING (public.is_group_member(group_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "settlements_insert_member"
    ON public.settlements FOR INSERT TO authenticated
    WITH CHECK (public.is_group_member(group_id) AND recorded_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Expense update/delete policies (20260714200000) ───────────────────────
DO $$ BEGIN
  CREATE POLICY "expenses_update_member"
    ON public.expenses FOR UPDATE TO authenticated
    USING (public.is_group_member(group_id))
    WITH CHECK (public.is_group_member(group_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "expenses_delete_member"
    ON public.expenses FOR DELETE TO authenticated
    USING (public.is_group_member(group_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

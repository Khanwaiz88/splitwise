-- Recorded settle-up payments between group members

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

CREATE POLICY "settlements_select_member"
  ON public.settlements FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "settlements_insert_member"
  ON public.settlements FOR INSERT TO authenticated
  WITH CHECK (
    public.is_group_member(group_id)
    AND recorded_by = auth.uid()
  );

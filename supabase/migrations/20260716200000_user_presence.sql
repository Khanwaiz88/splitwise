-- User online presence (heartbeat + last seen)

CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen
  ON public.user_presence (last_seen_at DESC);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presence_select_authenticated" ON public.user_presence;
CREATE POLICY "presence_select_authenticated"
  ON public.user_presence FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "presence_upsert_own" ON public.user_presence;
CREATE POLICY "presence_upsert_own"
  ON public.user_presence FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "presence_update_own" ON public.user_presence;
CREATE POLICY "presence_update_own"
  ON public.user_presence FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.heartbeat_presence()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_presence (user_id, last_seen_at)
  VALUES (auth.uid(), v_now)
  ON CONFLICT (user_id)
  DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at;

  RETURN v_now;
END;
$$;

GRANT EXECUTE ON FUNCTION public.heartbeat_presence() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_users_presence(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  last_seen_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.user_id, up.last_seen_at
  FROM public.user_presence up
  WHERE up.user_id = ANY(p_user_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_users_presence(uuid[]) TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.user_presence REPLICA IDENTITY FULL;

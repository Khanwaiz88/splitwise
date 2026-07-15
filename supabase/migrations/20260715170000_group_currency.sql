-- Per-group currency: USD, PKR, EUR, INR

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD'
  CHECK (currency IN ('USD', 'PKR', 'EUR', 'INR'));

DROP FUNCTION IF EXISTS public.get_user_groups();

CREATE OR REPLACE FUNCTION public.get_user_groups()
RETURNS TABLE (
  id uuid,
  name text,
  currency text,
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
    g.currency,
    g.created_at,
    COUNT(gm2.user_id)::bigint AS member_count
  FROM public.group_members gm
  JOIN public.groups g ON g.id = gm.group_id
  LEFT JOIN public.group_members gm2 ON gm2.group_id = g.id
  WHERE gm.user_id = auth.uid()
  GROUP BY g.id, g.name, g.currency, g.created_at
  ORDER BY g.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_groups() TO authenticated;

DROP FUNCTION IF EXISTS public.create_group_with_member(text);

CREATE OR REPLACE FUNCTION public.create_group_with_member(
  p_name text,
  p_currency text DEFAULT 'USD'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.groups%ROWTYPE;
  v_currency text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_currency := COALESCE(NULLIF(upper(trim(p_currency)), ''), 'USD');
  IF v_currency NOT IN ('USD', 'PKR', 'EUR', 'INR') THEN
    v_currency := 'USD';
  END IF;

  INSERT INTO public.groups (name, currency)
  VALUES (trim(p_name), v_currency)
  RETURNING * INTO v_group;

  INSERT INTO public.group_members (group_id, user_id)
  VALUES (v_group.id, auth.uid());

  RETURN json_build_object(
    'id', v_group.id,
    'name', v_group.name,
    'currency', v_group.currency,
    'created_at', v_group.created_at,
    'memberCount', 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_group_with_member(text, text) TO authenticated;

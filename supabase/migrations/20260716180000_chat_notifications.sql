-- Chat read state + unread counts for notifications

CREATE TABLE IF NOT EXISTS public.conversation_reads (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_reads_user
  ON public.conversation_reads (user_id);

ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversation_reads_select_own" ON public.conversation_reads;
CREATE POLICY "conversation_reads_select_own"
  ON public.conversation_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "conversation_reads_insert_own" ON public.conversation_reads;
CREATE POLICY "conversation_reads_insert_own"
  ON public.conversation_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "conversation_reads_update_own" ON public.conversation_reads;
CREATE POLICY "conversation_reads_update_own"
  ON public.conversation_reads FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_conversation_participant(p_conversation_id) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  INSERT INTO public.conversation_reads (conversation_id, user_id, last_read_at)
  VALUES (p_conversation_id, auth.uid(), now())
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET last_read_at = EXCLUDED.last_read_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_chat_unread_summary()
RETURNS TABLE (
  conversation_id uuid,
  unread_count bigint,
  conv_type text,
  title text,
  group_id uuid,
  other_user_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_conversations AS (
    SELECT c.id, c.type, c.group_id, c.dm_key
    FROM public.conversations c
    WHERE public.is_conversation_participant(c.id)
  ),
  unread AS (
    SELECT
      m.conversation_id,
      COUNT(*)::bigint AS unread_count
    FROM public.messages m
    JOIN my_conversations mc ON mc.id = m.conversation_id
    WHERE m.sender_id <> auth.uid()
      AND m.created_at > COALESCE(
        (
          SELECT cr.last_read_at
          FROM public.conversation_reads cr
          WHERE cr.conversation_id = m.conversation_id
            AND cr.user_id = auth.uid()
        ),
        '1970-01-01'::timestamptz
      )
    GROUP BY m.conversation_id
  )
  SELECT
    mc.id AS conversation_id,
    COALESCE(u.unread_count, 0) AS unread_count,
    mc.type AS conv_type,
    CASE
      WHEN mc.type = 'group' THEN COALESCE(g.name, 'Group Chat')
      ELSE COALESCE(
        NULLIF(trim(p.display_name), ''),
        NULLIF(split_part(p.email, '@', 1), ''),
        'Direct Message'
      )
    END AS title,
    mc.group_id,
    CASE
      WHEN mc.type = 'dm' THEN
        CASE
          WHEN split_part(mc.dm_key, ':', 1)::uuid = auth.uid()
            THEN split_part(mc.dm_key, ':', 2)::uuid
          ELSE split_part(mc.dm_key, ':', 1)::uuid
        END
      ELSE NULL::uuid
    END AS other_user_id
  FROM my_conversations mc
  LEFT JOIN unread u ON u.conversation_id = mc.id
  LEFT JOIN public.groups g ON g.id = mc.group_id
  LEFT JOIN public.profiles p ON mc.type = 'dm' AND p.id = (
    CASE
      WHEN split_part(mc.dm_key, ':', 1)::uuid = auth.uid()
        THEN split_part(mc.dm_key, ':', 2)::uuid
      ELSE split_part(mc.dm_key, ':', 1)::uuid
    END
  )
  WHERE COALESCE(u.unread_count, 0) > 0
  ORDER BY unread_count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_chat_unread_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_conversation_notification_label(p_conversation_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN c.type = 'group' THEN COALESCE(g.name, 'Group Chat')
    ELSE COALESCE(
      NULLIF(trim(p.display_name), ''),
      NULLIF(split_part(p.email, '@', 1), ''),
      'Direct Message'
    )
  END
  FROM public.conversations c
  LEFT JOIN public.groups g ON g.id = c.group_id
  LEFT JOIN public.profiles p ON c.type = 'dm' AND p.id = (
    CASE
      WHEN split_part(c.dm_key, ':', 1)::uuid = auth.uid()
        THEN split_part(c.dm_key, ':', 2)::uuid
      ELSE split_part(c.dm_key, ':', 1)::uuid
    END
  )
  WHERE c.id = p_conversation_id
    AND public.is_conversation_participant(p_conversation_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_conversation_notification_label(uuid) TO authenticated;

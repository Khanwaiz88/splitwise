-- Realtime text chat: group conversations + DM, with Realtime on messages

CREATE TABLE IF NOT EXISTS public.conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL CHECK (type IN ('group', 'dm')),
  group_id   uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  dm_key     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_group_dm_check CHECK (
    (type = 'group' AND group_id IS NOT NULL AND dm_key IS NULL)
    OR (type = 'dm' AND group_id IS NULL AND dm_key IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS conversations_group_unique
  ON public.conversations (group_id) WHERE type = 'group';

CREATE UNIQUE INDEX IF NOT EXISTS conversations_dm_unique
  ON public.conversations (dm_key) WHERE type = 'dm';

CREATE TABLE IF NOT EXISTS public.messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body             text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_body_length CHECK (
    char_length(trim(body)) > 0 AND char_length(body) <= 4000
  )
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages (conversation_id, created_at DESC);

-- ── Helpers ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.dm_key_for(p_user_a uuid, p_user_b uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_user_a::text < p_user_b::text THEN p_user_a::text || ':' || p_user_b::text
    ELSE p_user_b::text || ':' || p_user_a::text
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv public.conversations%ROWTYPE;
  uid uuid := auth.uid();
  part_a uuid;
  part_b uuid;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;

  SELECT * INTO conv FROM public.conversations WHERE id = p_conversation_id;
  IF conv.id IS NULL THEN RETURN false; END IF;

  IF conv.type = 'group' THEN
    RETURN public.is_group_member(conv.group_id);
  END IF;

  part_a := split_part(conv.dm_key, ':', 1)::uuid;
  part_b := split_part(conv.dm_key, ':', 2)::uuid;
  RETURN uid = part_a OR uid = part_b;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_or_create_group_conversation(p_group_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_group_member(p_group_id) THEN
    RAISE EXCEPTION 'Not a group member';
  END IF;

  SELECT id INTO v_id FROM public.conversations
  WHERE type = 'group' AND group_id = p_group_id;

  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  BEGIN
    INSERT INTO public.conversations (type, group_id)
    VALUES ('group', p_group_id)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_id FROM public.conversations
    WHERE type = 'group' AND group_id = p_group_id;
  END;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_group_conversation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_or_create_dm_conversation(p_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_key text;
  v_id uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_other_user_id IS NULL OR p_other_user_id = v_me THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_other_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  v_key := public.dm_key_for(v_me, p_other_user_id);

  SELECT id INTO v_id FROM public.conversations
  WHERE type = 'dm' AND dm_key = v_key;

  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  INSERT INTO public.conversations (type, dm_key)
  VALUES ('dm', v_key)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_dm_conversation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_chat_messages(
  p_conversation_id uuid,
  p_limit integer DEFAULT 50,
  p_before timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  sender_name text,
  body text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.conversation_id,
    m.sender_id,
    COALESCE(
      NULLIF(trim(p.display_name), ''),
      NULLIF(split_part(p.email, '@', 1), ''),
      'User'
    ) AS sender_name,
    m.body,
    m.created_at
  FROM public.messages m
  LEFT JOIN public.profiles p ON p.id = m.sender_id
  WHERE m.conversation_id = p_conversation_id
    AND public.is_conversation_participant(p_conversation_id)
    AND (p_before IS NULL OR m.created_at < p_before)
  ORDER BY m.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.get_chat_messages(uuid, integer, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_dm_contacts()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    p.id AS user_id,
    COALESCE(
      NULLIF(trim(p.display_name), ''),
      NULLIF(split_part(p.email, '@', 1), ''),
      'User'
    ) AS display_name,
    COALESCE(p.email, '') AS email
  FROM public.group_members gm_self
  JOIN public.group_members gm_other
    ON gm_other.group_id = gm_self.group_id
    AND gm_other.user_id <> gm_self.user_id
  JOIN public.profiles p ON p.id = gm_other.user_id
  WHERE gm_self.user_id = auth.uid()
  ORDER BY display_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_dm_contacts() TO authenticated;

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant"
  ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_participant(id));

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant"
  ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "messages_insert_participant" ON public.messages;
CREATE POLICY "messages_insert_participant"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id)
  );

-- ── Realtime ───────────────────────────────────────────────────────────────

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.messages REPLICA IDENTITY FULL;

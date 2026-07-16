'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { ChatMessage } from '@/utils/chatApi';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type TypingUser = {
  userId: string;
  displayName: string;
  expiresAt: number;
};

type TypingPayload = {
  user_id: string;
  display_name: string;
  is_typing: boolean;
};

const TYPING_TTL_MS = 4500;
const TYPING_DEBOUNCE_MS = 250;
const TYPING_STOP_MS = 2200;

function isWeakName(name: string | undefined): boolean {
  if (!name?.trim()) return true;
  const n = name.trim().toLowerCase();
  return n === 'someone' || n === 'you' || n === 'user' || n === 'member';
}

async function fetchDisplayName(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(userId);
  if (cached) return cached;

  const { data } = await supabase
    .from('profiles')
    .select('display_name, email')
    .eq('id', userId)
    .maybeSingle();

  const name =
    data?.display_name?.trim() ||
    data?.email?.split('@')[0] ||
    'User';

  cache.set(userId, name);
  return name;
}

export function useChatRealtime(
  conversationId: string | null,
  currentUserId: string,
  currentDisplayName: string,
) {
  const supabase = createClient();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [ready, setReady] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const nameCacheRef = useRef(new Map<string, string>());
  const senderNameRef = useRef(currentDisplayName);

  useEffect(() => {
    senderNameRef.current = currentDisplayName;
    if (currentUserId && !isWeakName(currentDisplayName)) {
      nameCacheRef.current.set(currentUserId, currentDisplayName.trim());
    }
  }, [currentDisplayName, currentUserId]);

  const pruneTyping = useCallback(() => {
    const now = Date.now();
    setTypingUsers((prev) => prev.filter((u) => u.expiresAt > now));
  }, []);

  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    setReady(false);
    const channel = supabase.channel(`chat:${conversationId}`, {
      config: { broadcast: { ack: false, self: false } },
    });

    channel
      .on('broadcast', { event: 'typing' }, (event: { payload?: TypingPayload }) => {
        const p = event.payload;
        if (!p?.user_id || p.user_id === currentUserId) return;

        if (!p.is_typing) {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== p.user_id));
          return;
        }

        void (async () => {
          let displayName = p.display_name?.trim() ?? '';
          if (isWeakName(displayName)) {
            displayName = await fetchDisplayName(supabase, p.user_id, nameCacheRef.current);
          }

          setTypingUsers((prev) => {
            const filtered = prev.filter((u) => u.userId !== p.user_id);
            return [
              ...filtered,
              {
                userId: p.user_id,
                displayName,
                expiresAt: Date.now() + TYPING_TTL_MS,
              },
            ];
          });
        })();
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          channelRef.current = channel;
          setReady(true);
        }
      });

    const pruneInterval = setInterval(pruneTyping, 800);

    return () => {
      clearInterval(pruneInterval);
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      void supabase.removeChannel(channel);
      channelRef.current = null;
      setReady(false);
      setTypingUsers([]);
    };
  }, [conversationId, currentUserId, supabase, pruneTyping]);

  const broadcastTyping = useCallback(
    (isTyping: boolean) => {
      const channel = channelRef.current;
      if (!channel || !conversationId || !ready) return;

      const name = isWeakName(senderNameRef.current)
        ? 'User'
        : senderNameRef.current.trim();

      void channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          user_id: currentUserId,
          display_name: name,
          is_typing: isTyping,
        } satisfies TypingPayload,
      });
    },
    [conversationId, currentUserId, ready],
  );

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current > TYPING_DEBOUNCE_MS) {
      lastTypingSentRef.current = now;
      broadcastTyping(true);
    }

    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => broadcastTyping(false), TYPING_STOP_MS);
  }, [broadcastTyping]);

  const stopTyping = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    broadcastTyping(false);
  }, [broadcastTyping]);

  return { typingUsers, notifyTyping, stopTyping };
}

export function useChatMessages(
  conversationId: string | null,
  initialMessages: ChatMessage[],
  currentUserId: string,
) {
  const supabase = createClient();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages, conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (event: { new: Record<string, unknown> }) => {
          const row = event.new as {
            id: string;
            conversation_id: string;
            sender_id: string;
            body: string;
            created_at: string;
          };

          if (row.sender_id === currentUserId) return;

          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, email')
            .eq('id', row.sender_id)
            .maybeSingle();

          const senderName =
            profile?.display_name?.trim() ||
            profile?.email?.split('@')[0] ||
            'User';

          const msg: ChatMessage = {
            id: row.id,
            conversation_id: row.conversation_id,
            sender_id: row.sender_id,
            sender_name: senderName,
            body: row.body,
            created_at: row.created_at,
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, supabase]);

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  return { messages, appendMessage, setMessages };
}

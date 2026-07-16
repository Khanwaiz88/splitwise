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

const TYPING_TTL_MS = 4000;
const TYPING_DEBOUNCE_MS = 300;
const TYPING_STOP_MS = 2500;

export function useChatRealtime(
  conversationId: string | null,
  currentUserId: string,
  currentDisplayName: string,
) {
  const supabase = createClient();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);

  const pruneTyping = useCallback(() => {
    const now = Date.now();
    setTypingUsers((prev) => prev.filter((u) => u.expiresAt > now));
  }, []);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase.channel(`chat:${conversationId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'typing' }, (event: { payload?: TypingPayload }) => {
        const p = event.payload;
        if (!p?.user_id || p.user_id === currentUserId) return;

        if (!p.is_typing) {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== p.user_id));
          return;
        }

        setTypingUsers((prev) => {
          const filtered = prev.filter((u) => u.userId !== p.user_id);
          return [
            ...filtered,
            {
              userId: p.user_id,
              displayName: p.display_name || 'Someone',
              expiresAt: Date.now() + TYPING_TTL_MS,
            },
          ];
        });
      })
      .subscribe();

    channelRef.current = channel;

    const pruneInterval = setInterval(pruneTyping, 1000);

    return () => {
      clearInterval(pruneInterval);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
      setTypingUsers([]);
    };
  }, [conversationId, currentUserId, supabase, pruneTyping]);

  const broadcastTyping = useCallback(
    (isTyping: boolean) => {
      if (!channelRef.current || !conversationId) return;
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          user_id: currentUserId,
          display_name: currentDisplayName,
          is_typing: isTyping,
        } satisfies TypingPayload,
      });
    },
    [conversationId, currentUserId, currentDisplayName],
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
      supabase.removeChannel(channel);
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

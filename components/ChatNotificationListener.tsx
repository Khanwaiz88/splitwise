'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClient } from '@/utils/supabase/client';
import {
  dispatchChatUnreadChanged,
  getActiveChatConversation,
} from '@/utils/chatActiveConversation';

function previewBody(body: string, max = 80): string {
  const t = body.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

async function fetchSenderName(
  supabase: ReturnType<typeof createClient>,
  senderId: string,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(senderId);
  if (cached) return cached;

  const { data } = await supabase
    .from('profiles')
    .select('display_name, email')
    .eq('id', senderId)
    .maybeSingle();

  const name =
    data?.display_name?.trim() ||
    data?.email?.split('@')[0] ||
    'Someone';

  cache.set(senderId, name);
  return name;
}

async function fetchConversationLabel(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(conversationId);
  if (cached) return cached;

  const { data, error } = await supabase.rpc('get_conversation_notification_label', {
    p_conversation_id: conversationId,
  });

  const label = !error && data ? String(data) : 'Chat';
  cache.set(conversationId, label);
  return label;
}

function showBrowserNotification(title: string, body: string) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  if (!document.hidden) return;

  try {
    const n = new Notification(title, {
      body,
      icon: '/icon-192x192.png',
      tag: `chat-${title}`,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* ignore */
  }
}

export default function ChatNotificationListener({ userId }: { userId: string }) {
  const router = useRouter();
  const senderCache = useRef(new Map<string, string>());
  const labelCache = useRef(new Map<string, string>());

  useEffect(() => {
    if (!userId || userId === 'offline') return;

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }

    const supabase = createClient();

    const channel = supabase
      .channel(`chat-notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (event: { new: Record<string, unknown> }) => {
          const row = event.new as {
            id: string;
            conversation_id: string;
            sender_id: string;
            body: string;
          };

          if (row.sender_id === userId) return;

          void (async () => {
            const activeId = getActiveChatConversation();
            const isViewing = activeId === row.conversation_id;

            if (!isViewing) {
              dispatchChatUnreadChanged();
            }

            const [senderName, chatLabel] = await Promise.all([
              fetchSenderName(supabase, row.sender_id, senderCache.current),
              fetchConversationLabel(supabase, row.conversation_id, labelCache.current),
            ]);

            const snippet = previewBody(row.body);
            const toastTitle = `${senderName} · ${chatLabel}`;

            if (!isViewing) {
              toast(
                (t) => (
                  <button
                    type="button"
                    className="text-left w-full"
                    onClick={() => {
                      toast.dismiss(t.id);
                      router.push('/dashboard/chat');
                    }}
                  >
                    <p className="font-bold text-sm">{toastTitle}</p>
                    <p className="text-xs opacity-80 mt-0.5 line-clamp-2">{snippet}</p>
                  </button>
                ),
                { duration: 6000, icon: '💬' },
              );

              showBrowserNotification(toastTitle, snippet);
            }
          })();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}

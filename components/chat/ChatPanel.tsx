'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import ChatThread from '@/components/chat/ChatThread';
import ChatInput from '@/components/chat/ChatInput';
import TypingIndicator, { typingStatusText } from '@/components/chat/TypingIndicator';
import { PresenceDot, PresenceStatusText } from '@/components/chat/PresenceIndicator';
import ChatAvatar from '@/components/chat/ChatAvatar';
import {
  fetchChatMessages,
  sendChatMessage,
  markConversationRead,
  type ChatMessage,
  type ConversationInfo,
} from '@/utils/chatApi';
import { useChatMessages, useChatRealtime } from '@/utils/useChatRealtime';
import { setActiveChatConversation, dispatchChatUnreadChanged } from '@/utils/chatActiveConversation';
import { usePresence } from '@/utils/usePresence';
import { resolveOfflineProfile, saveProfileCache } from '@/utils/profileCache';

function resolveDisplayName(profile: {
  display_name?: string | null;
  email?: string | null;
}): string {
  return (
    profile.display_name?.trim() ||
    profile.email?.split('@')[0] ||
    'User'
  );
}

export default function ChatPanel({
  conversation,
  currentUserId,
  currentDisplayName,
}: {
  conversation: ConversationInfo;
  currentUserId: string;
  currentDisplayName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const [senderName, setSenderName] = useState(currentDisplayName);
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const presenceIds =
    conversation.type === 'dm' && conversation.otherUserId
      ? [conversation.otherUserId]
      : groupMemberIds.filter((id) => id !== currentUserId);

  const { get: getPresence, onlineCount } = usePresence(presenceIds);

  const { messages, appendMessage } = useChatMessages(
    conversation.conversationId,
    initialMessages,
    currentUserId,
  );

  const { typingUsers, notifyTyping, stopTyping } = useChatRealtime(
    conversation.conversationId,
    currentUserId,
    senderName,
  );

  useEffect(() => {
    setSenderName(currentDisplayName);
  }, [currentDisplayName]);

  useEffect(() => {
    if (!currentUserId) return;
    const cached = resolveOfflineProfile();
    if (cached?.display_name?.trim()) {
      setSenderName(cached.display_name.trim());
    }
    void (async () => {
      try {
        const res = await fetch('/api/profile', { credentials: 'include', cache: 'no-store' });
        const data = await res.json();
        if (res.ok && data.profile) {
          const name = resolveDisplayName(data.profile);
          setSenderName(name);
          saveProfileCache(data.profile);
        }
      } catch { /* use cached name */ }
    })();
  }, [currentUserId]);

  useEffect(() => {
    if (conversation.type !== 'group' || !conversation.groupId) {
      setGroupMemberIds([]);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(`/api/groups/${conversation.groupId}/members`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.members)) {
          setGroupMemberIds(data.members.map((m: { id: string }) => m.id));
        }
      } catch {
        setGroupMemberIds([]);
      }
    })();
  }, [conversation.type, conversation.groupId]);

  useEffect(() => {
    setActiveChatConversation(conversation.conversationId);
    void markConversationRead(conversation.conversationId).then(() => dispatchChatUnreadChanged());

    return () => {
      setActiveChatConversation(null);
    };
  }, [conversation.conversationId]);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      void markConversationRead(conversation.conversationId).then(() => dispatchChatUnreadChanged());
    }, 500);
    return () => clearTimeout(t);
  }, [loading, messages.length, conversation.conversationId]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchChatMessages(conversation.conversationId);
      setInitialMessages(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [conversation.conversationId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const handleSend = async (body: string) => {
    stopTyping();
    try {
      const msg = await sendChatMessage(conversation.conversationId, body);
      appendMessage(msg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send');
      throw err;
    }
  };

  const typingText = typingStatusText(typingUsers);
  const dmPresence = conversation.otherUserId
    ? getPresence(conversation.otherUserId)
    : undefined;
  const groupOnline = conversation.type === 'group'
    ? onlineCount(groupMemberIds.filter((id) => id !== currentUserId))
    : 0;

  let subtitle: ReactNode;
  if (typingText) {
    subtitle = typingText;
  } else if (conversation.type === 'dm') {
    subtitle = <PresenceStatusText entry={dmPresence} />;
  } else if (groupOnline > 0) {
    subtitle = (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-lime-400">
        <PresenceDot online size="sm" className="border-transparent shadow-none" />
        {groupOnline} online in group
      </span>
    );
  } else {
    subtitle = 'Group chat';
  }

  return (
    <div className="flex flex-col h-full min-h-0 max-h-full widget widget-violet widget-flush overflow-hidden">
      <div className="shrink-0 px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          {conversation.type === 'dm' && conversation.otherUserId ? (
            <div className="relative shrink-0">
              <ChatAvatar
                userId={conversation.otherUserId}
                name={conversation.title}
                className="mt-0"
              />
              <span className="absolute -bottom-0.5 -right-0.5">
                <PresenceDot online={dmPresence?.isOnline ?? false} size="sm" />
              </span>
            </div>
          ) : conversation.groupId ? (
            <ChatAvatar
              userId={conversation.groupId}
              name={conversation.title}
              className="mt-0"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-extrabold text-white truncate">{conversation.title}</h2>
            <p
              className={`text-[11px] font-semibold mt-0.5 truncate transition-colors ${
                typingText ? 'text-violet-300' : 'text-white/40'
              }`}
            >
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      <ChatThread messages={messages} currentUserId={currentUserId} loading={loading} />
      <div ref={bottomRef} />
      <TypingIndicator users={typingUsers} />
      <ChatInput onSend={handleSend} onTyping={notifyTyping} onStopTyping={stopTyping} />
    </div>
  );
}

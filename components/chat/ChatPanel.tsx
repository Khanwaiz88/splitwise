'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import ChatThread from '@/components/chat/ChatThread';
import ChatInput from '@/components/chat/ChatInput';
import TypingIndicator from '@/components/chat/TypingIndicator';
import {
  fetchChatMessages,
  sendChatMessage,
  type ChatMessage,
  type ConversationInfo,
} from '@/utils/chatApi';
import { useChatMessages, useChatRealtime } from '@/utils/useChatRealtime';

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
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, appendMessage } = useChatMessages(
    conversation.conversationId,
    initialMessages,
    currentUserId,
  );

  const { typingUsers, notifyTyping, stopTyping } = useChatRealtime(
    conversation.conversationId,
    currentUserId,
    currentDisplayName,
  );

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
    try {
      const msg = await sendChatMessage(conversation.conversationId, body);
      appendMessage(msg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send');
      throw err;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 widget widget-violet widget-flush overflow-hidden">
      <div className="shrink-0 px-4 py-3 border-b border-white/10">
        <h2 className="text-sm font-extrabold text-white truncate">{conversation.title}</h2>
        <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mt-0.5">
          {conversation.type === 'group' ? 'Group chat' : 'Direct message'}
        </p>
      </div>

      <ChatThread messages={messages} currentUserId={currentUserId} loading={loading} />
      <div ref={bottomRef} />
      <TypingIndicator users={typingUsers} />
      <ChatInput onSend={handleSend} onTyping={notifyTyping} onStopTyping={stopTyping} />
    </div>
  );
}

'use client';

import { forwardRef, type UIEventHandler } from 'react';
import { MessageSquare } from 'lucide-react';
import { formatChatTime, type ChatMessage } from '@/utils/chatApi';
import ChatAvatar from '@/components/chat/ChatAvatar';

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function sameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function isCompactWithPrevious(prev: ChatMessage | undefined, msg: ChatMessage): boolean {
  if (!prev || prev.sender_id !== msg.sender_id) return false;
  const gap = new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime();
  return gap < 3 * 60 * 1000;
}

const ChatThread = forwardRef<
  HTMLDivElement,
  {
    messages: ChatMessage[];
    currentUserId: string;
    loading?: boolean;
    isGroup?: boolean;
    onScroll?: UIEventHandler<HTMLDivElement>;
  }
>(function ChatThread({ messages, currentUserId, loading, isGroup, onScroll }, ref) {
  if (loading) {
    return (
      <div
        ref={ref}
        onScroll={onScroll}
        className="chat-thread-scroll flex-1 min-h-0 overflow-y-auto space-y-3 p-4"
      >
        {[1, 2, 3].map((i) => (
          <div key={i} className={`flex gap-2.5 ${i % 2 === 0 ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className="w-9 h-9 rounded-full widget animate-shimmer shrink-0" />
            <div className={`h-12 w-48 widget animate-shimmer rounded-2xl ${i % 2 === 0 ? 'rounded-br-md' : 'rounded-bl-md'}`} />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div
        ref={ref}
        onScroll={onScroll}
        className="chat-thread-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain p-4"
      >
        <div className="min-h-full flex flex-col items-center justify-center text-center gap-3 py-10">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <MessageSquare size={24} className="text-violet-300/70" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/70">No messages yet</p>
            <p className="text-xs text-white/40 mt-1">Send a message to start the conversation</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className="chat-thread-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4"
    >
      <div className="space-y-1">
        {messages.map((msg, index) => {
          const mine = msg.sender_id === currentUserId;
          const prev = index > 0 ? messages[index - 1] : undefined;
          const compact = isCompactWithPrevious(prev, msg);
          const showDate = !prev || !sameDay(prev.created_at, msg.created_at);
          const showAvatar = !mine && !compact;
          const showSender = !mine && isGroup && !compact;

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex justify-center my-4">
                  <span className="chat-date-pill">{formatDateLabel(msg.created_at)}</span>
                </div>
              )}
              <div
                className={`flex gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'} ${
                  compact ? 'mt-0.5' : 'mt-3'
                }`}
              >
                {!mine && (
                  <div className="w-8 shrink-0 flex items-end">
                    {showAvatar ? (
                      <ChatAvatar userId={msg.sender_id} name={msg.sender_name} size="sm" className="mt-0" />
                    ) : (
                      <span className="w-8" aria-hidden />
                    )}
                  </div>
                )}
                <div className={`max-w-[82%] min-w-0 flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  {showSender && (
                    <span className="text-[11px] font-semibold text-white/50 mb-1 px-1">
                      {msg.sender_name}
                    </span>
                  )}
                  <div
                    className={`chat-bubble px-3.5 py-2 text-[15px] leading-relaxed break-words ${
                      mine ? 'chat-bubble-mine' : 'chat-bubble-theirs'
                    } ${compact ? (mine ? 'rounded-2xl rounded-tr-md' : 'rounded-2xl rounded-tl-md') : ''}`}
                  >
                    <span className="whitespace-pre-wrap">{msg.body}</span>
                    <span className={`chat-bubble-time ${mine ? 'text-white/55' : 'text-white/35'}`}>
                      {formatChatTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default ChatThread;

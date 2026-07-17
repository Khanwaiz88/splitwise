'use client';

import { formatChatTime, type ChatMessage } from '@/utils/chatApi';
import ChatAvatar from '@/components/chat/ChatAvatar';

export default function ChatThread({
  messages,
  currentUserId,
  loading,
}: {
  messages: ChatMessage[];
  currentUserId: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`flex gap-2.5 ${i % 2 === 0 ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className="w-9 h-9 rounded-xl widget animate-shimmer shrink-0" />
            <div className={`h-12 w-48 widget animate-shimmer rounded-2xl ${i % 2 === 0 ? 'rounded-br-md' : 'rounded-bl-md'}`} />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center p-6 text-center">
        <p className="text-sm text-white/45 font-medium">
          No messages yet. Say hello!
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">
      {messages.map((msg) => {
        const mine = msg.sender_id === currentUserId;
        return (
          <div key={msg.id} className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
            <ChatAvatar userId={msg.sender_id} name={msg.sender_name} />
            <div className={`max-w-[78%] min-w-0 ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
              {!mine && (
                <span className="text-[10px] font-bold text-white/45 mb-1 px-1">
                  {msg.sender_name}
                </span>
              )}
              <div
                className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                  mine
                    ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white rounded-br-md shadow-lg shadow-violet-500/20'
                    : 'glass-light border border-white/10 text-white rounded-bl-md'
                }`}
              >
                {msg.body}
              </div>
              <span className="text-[10px] text-white/30 mt-1 px-1">
                {formatChatTime(msg.created_at)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

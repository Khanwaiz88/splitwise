'use client';

import { avatarGradient } from '@/utils/avatarColor';
import { formatChatTime, type ChatMessage } from '@/utils/chatApi';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
          <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
            <div className="h-12 w-48 widget animate-shimmer rounded-2xl" />
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
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3">
      {messages.map((msg) => {
        const mine = msg.sender_id === currentUserId;
        const grad = avatarGradient(msg.sender_id);
        return (
          <div key={msg.id} className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
            {!mine && (
              <div
                className={`w-8 h-8 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center shrink-0 shadow-md mt-1`}
              >
                <span className="text-[10px] font-extrabold text-white">
                  {initials(msg.sender_name)}
                </span>
              </div>
            )}
            <div className={`max-w-[80%] min-w-0 ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
              {!mine && (
                <span className="text-[10px] font-bold text-white/40 mb-1 px-1">
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

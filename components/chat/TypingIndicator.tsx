'use client';

import type { TypingUser } from '@/utils/useChatRealtime';
import ChatAvatar from '@/components/chat/ChatAvatar';

function typingLabel(users: TypingUser[]): string {
  if (users.length === 0) return '';
  if (users.length === 1) return `${users[0].displayName} is typing`;
  if (users.length === 2) {
    return `${users[0].displayName} and ${users[1].displayName} are typing`;
  }
  return `${users.slice(0, -1).map((u) => u.displayName).join(', ')}, and ${users[users.length - 1].displayName} are typing`;
}

export default function TypingIndicator({ users }: { users: TypingUser[] }) {
  if (users.length === 0) return null;

  const label = typingLabel(users);
  const shown = users.slice(0, 3);

  return (
    <div className="shrink-0 px-4 py-2 flex items-center gap-2.5 text-xs text-violet-200/90 font-medium bg-violet-500/[0.07] border-t border-violet-500/15 animate-fade-in-up">
      <div className="flex -space-x-2 shrink-0">
        {shown.map((u) => (
          <ChatAvatar
            key={u.userId}
            userId={u.userId}
            name={u.displayName}
            size="sm"
            className="mt-0 ring-2 ring-[var(--bg-elevated)]"
          />
        ))}
      </div>
      <span className="flex gap-1 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
      </span>
      <span className="truncate text-xs">{label}…</span>
    </div>
  );
}

export function typingStatusText(users: TypingUser[]): string | null {
  if (users.length === 0) return null;
  return `${typingLabel(users)}…`;
}

'use client';

import type { TypingUser } from '@/utils/useChatRealtime';

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

  return (
    <div className="shrink-0 px-4 py-2 flex items-center gap-2.5 text-sm text-violet-200 font-semibold bg-violet-500/10 border-t border-violet-500/20 animate-fade-in-up">
      <span className="flex gap-1 shrink-0">
        <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
      </span>
      <span className="truncate">{label}…</span>
    </div>
  );
}

export function typingStatusText(users: TypingUser[]): string | null {
  if (users.length === 0) return null;
  return `${typingLabel(users)}…`;
}

'use client';

import type { TypingUser } from '@/utils/useChatRealtime';

export default function TypingIndicator({ users }: { users: TypingUser[] }) {
  if (users.length === 0) return null;

  const label =
    users.length === 1
      ? `${users[0].displayName} is typing`
      : `${users.map((u) => u.displayName).join(', ')} are typing`;

  return (
    <div className="px-4 pb-1 flex items-center gap-2 text-xs text-violet-300/80 font-medium animate-fade-in-up">
      <span className="flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
      </span>
      <span className="truncate">{label}…</span>
    </div>
  );
}

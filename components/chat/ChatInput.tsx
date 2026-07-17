'use client';

import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';

export default function ChatInput({
  onSend,
  onTyping,
  onStopTyping,
  disabled,
}: {
  onSend: (text: string) => Promise<void>;
  onTyping: () => void;
  onStopTyping: () => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;

    setSending(true);
    onStopTyping();
    try {
      await onSend(trimmed);
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 px-3 py-2.5 border-t border-white/[0.06] bg-[var(--nav-bg)]/90 backdrop-blur-xl chat-input-bar"
    >
      <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-1.5 focus-within:border-violet-500/35 focus-within:ring-1 focus-within:ring-violet-500/15 transition-all">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) onTyping();
            else onStopTyping();
          }}
          onBlur={onStopTyping}
          placeholder="Write a message…"
          rows={1}
          disabled={disabled || sending}
          className="flex-1 min-h-[40px] max-h-32 resize-none py-2 bg-transparent border-0 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-0"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={disabled || sending || !text.trim()}
          className="shrink-0 w-9 h-9 rounded-xl btn-gradient flex items-center justify-center disabled:opacity-40 disabled:grayscale transition-all"
          aria-label="Send message"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </form>
  );
}

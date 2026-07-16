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
      className="shrink-0 p-3 border-t border-[var(--border-subtle)] bg-[var(--nav-bg)]/80 backdrop-blur-md"
    >
      <div className="flex gap-2 items-end">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) onTyping();
            else onStopTyping();
          }}
          onBlur={onStopTyping}
          placeholder="Type a message…"
          rows={1}
          disabled={disabled || sending}
          className="input-field flex-1 min-h-[44px] max-h-32 resize-none py-3"
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
          className="shrink-0 w-11 h-11 rounded-xl btn-gradient flex items-center justify-center disabled:opacity-50"
          aria-label="Send message"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </form>
  );
}

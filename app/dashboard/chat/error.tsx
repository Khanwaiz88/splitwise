'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, MessageSquare } from 'lucide-react';

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard/chat]', error);
  }, [error]);

  return (
    <div className="page-stack">
      <div className="widget widget-rose p-8 text-center max-w-md mx-auto">
        <AlertCircle className="mx-auto text-rose-300 mb-4" size={40} />
        <h2 className="text-lg font-extrabold text-white mb-2">Chat failed to load</h2>
        <p className="text-sm text-white/50 mb-6 leading-relaxed">
          Something went wrong opening this conversation. Try again or return to the chat list.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button type="button" onClick={reset} className="btn-gradient px-5 py-2.5 rounded-xl text-sm font-bold">
            Try again
          </button>
          <Link
            href="/dashboard/chat"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-white/15 text-sm font-bold text-white/70 hover:text-white"
          >
            <MessageSquare size={16} /> Back to chat
          </Link>
        </div>
      </div>
    </div>
  );
}

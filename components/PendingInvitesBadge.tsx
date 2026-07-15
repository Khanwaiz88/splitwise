'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox } from 'lucide-react';
import { fetchPendingInvites } from '@/utils/invitesApi';

export default function PendingInvitesBadge({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const active = pathname === '/dashboard/invites';
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const { count: c } = await fetchPendingInvites();
      setCount(c);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    window.addEventListener('invitesChanged', load);
    return () => {
      clearInterval(interval);
      window.removeEventListener('invitesChanged', load);
    };
  }, [load]);

  if (compact) {
    return (
      <Link
        href="/dashboard/invites"
        className="relative p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
        aria-label={count > 0 ? `${count} pending invites` : 'Invites'}
        title="Group invites"
      >
        <Inbox size={18} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-extrabold border-2 border-[var(--nav-bg)]">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Link>
    );
  }

  return (
    <Link
      href="/dashboard/invites"
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border ${
        active
          ? 'bg-gradient-to-r from-violet-500/25 to-fuchsia-500/20 text-white border-violet-500/30 shadow-lg shadow-violet-500/10'
          : 'text-white/50 hover:text-white hover:bg-white/5 border-transparent'
      }`}
    >
      <span className="relative">
        <Inbox size={18} />
        {count > 0 && (
          <span className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-extrabold">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </span>
      Invites
      {count > 0 && (
        <span className="ml-auto text-xs font-bold text-rose-300 bg-rose-500/15 px-2 py-0.5 rounded-full">
          {count} new
        </span>
      )}
    </Link>
  );
}

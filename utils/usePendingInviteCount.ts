'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchPendingInvites } from '@/utils/invitesApi';

export function usePendingInviteCount() {
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

  return count;
}

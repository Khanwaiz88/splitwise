'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  fetchUsersPresence,
  isUserOnline,
  toPresenceEntry,
  type PresenceEntry,
} from '@/utils/presenceApi';

function stableIdsKey(userIds: string[]): string {
  return [...new Set(userIds.filter(Boolean))].sort().join(',');
}

export function usePresence(userIds: string[]) {
  const [map, setMap] = useState<Record<string, PresenceEntry>>({});
  const idsKey = useMemo(() => stableIdsKey(userIds), [userIds.join('|')]);

  const load = useCallback(async () => {
    const ids = idsKey ? idsKey.split(',') : [];
    if (ids.length === 0) {
      setMap({});
      return;
    }
    try {
      const raw = await fetchUsersPresence(ids);
      const next: Record<string, PresenceEntry> = {};
      for (const id of ids) {
        next[id] = toPresenceEntry(raw[id]);
      }
      setMap(next);
    } catch {
      /* presence table may not exist yet */
    }
  }, [idsKey]);

  useEffect(() => {
    void load();
    const interval = setInterval(load, 20_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : [];
    if (ids.length === 0) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`presence:${idsKey}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_presence' },
        (event: { new: Record<string, unknown> }) => {
          const row = event.new as { user_id?: string; last_seen_at?: string };
          if (!row.user_id || !ids.includes(row.user_id)) return;
          setMap((prev) => ({
            ...prev,
            [row.user_id!]: toPresenceEntry(row.last_seen_at),
          }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [idsKey]);

  useEffect(() => {
    const tick = setInterval(() => {
      setMap((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [id, entry] of Object.entries(prev)) {
          const online = isUserOnline(entry.lastSeenAt);
          if (online !== entry.isOnline) {
            next[id] = { ...entry, isOnline: online };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 15_000);
    return () => clearInterval(tick);
  }, []);

  const get = useCallback(
    (userId: string) => map[userId],
    [map],
  );

  const onlineCount = useCallback(
    (ids: string[]) => ids.filter((id) => map[id]?.isOnline).length,
    [map],
  );

  return { map, get, onlineCount, reload: load };
}

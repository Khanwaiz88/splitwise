'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  dispatchGroupDataChanged,
  extractGroupIdFromPayload,
  type GroupDataTable,
} from '@/utils/groupDataEvents';

const REALTIME_TABLES: GroupDataTable[] = [
  'expenses',
  'settlements',
  'group_members',
  'group_guest_members',
  'groups',
  'activity_log',
];

const DEBOUNCE_MS = 300;

type RealtimePayload = {
  new: Record<string, unknown>;
  old: Record<string, unknown>;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
};

export default function GroupDataListener({ userId }: { userId: string }) {
  const debounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!userId || userId === 'offline') return;

    const supabase = createClient();

    const notify = (
      table: GroupDataTable,
      eventType: RealtimePayload['eventType'],
      groupId: string | null,
    ) => {
      const key = groupId ?? '__global__';
      const timers = debounceRef.current;
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);

      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          dispatchGroupDataChanged({ groupId, table, eventType });
        }, DEBOUNCE_MS),
      );
    };

    const handleChange = (table: GroupDataTable) => (payload: RealtimePayload) => {
      if (!navigator.onLine) return;

      const groupId = extractGroupIdFromPayload(table, payload);
      console.info('[realtime] group data changed', {
        table,
        eventType: payload.eventType,
        groupId,
      });

      notify(table, payload.eventType, groupId);
    };

    let channel = supabase.channel(`group-data:${userId}`);

    for (const table of REALTIME_TABLES) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        handleChange(table),
      );
    }

    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        console.info('[realtime] subscribed to group data');
      }
      if (status === 'CHANNEL_ERROR') {
        console.error('[realtime] group data channel error');
      }
    });

    return () => {
      for (const timer of debounceRef.current.values()) {
        clearTimeout(timer);
      }
      debounceRef.current.clear();
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return null;
}

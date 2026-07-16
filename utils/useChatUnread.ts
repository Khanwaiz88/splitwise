'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchChatUnread, type ChatUnreadItem } from '@/utils/chatApi';

export function useChatUnread() {
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<ChatUnreadItem[]>([]);

  const load = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const data = await fetchChatUnread();
      setTotal(data.total);
      setItems(data.items);
    } catch {
      /* migration may not be applied yet */
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 45_000);
    window.addEventListener('chatUnreadChanged', load);
    return () => {
      clearInterval(interval);
      window.removeEventListener('chatUnreadChanged', load);
    };
  }, [load]);

  const unreadForGroup = useCallback(
    (groupId: string) =>
      items.find((i) => i.type === 'group' && i.groupId === groupId)?.unreadCount ?? 0,
    [items],
  );

  const unreadForUser = useCallback(
    (userId: string) =>
      items.find((i) => i.type === 'dm' && i.otherUserId === userId)?.unreadCount ?? 0,
    [items],
  );

  return { total, items, reload: load, unreadForGroup, unreadForUser };
}

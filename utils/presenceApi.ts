/** Online if last heartbeat was within this window (ms) */
export const PRESENCE_ONLINE_MS = 90_000;

export type PresenceEntry = {
  lastSeenAt: string | null;
  isOnline: boolean;
};

export function isUserOnline(lastSeenAt: string | null | undefined, now = Date.now()): boolean {
  if (!lastSeenAt) return false;
  return now - new Date(lastSeenAt).getTime() < PRESENCE_ONLINE_MS;
}

export function formatLastSeen(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return 'Last seen recently';
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < 60_000) return 'Last seen just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `Last seen ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Last seen yesterday';
  if (days < 7) return `Last seen ${days}d ago`;
  return `Last seen ${new Date(lastSeenAt).toLocaleDateString()}`;
}

export function presenceStatusLabel(entry: PresenceEntry | undefined): string {
  if (!entry?.lastSeenAt) return 'Offline';
  return entry.isOnline ? 'Online' : formatLastSeen(entry.lastSeenAt);
}

export async function sendPresenceHeartbeat(): Promise<void> {
  if (!navigator.onLine) return;
  await fetch('/api/presence', { method: 'POST', credentials: 'include' });
}

export async function fetchUsersPresence(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};
  const qs = userIds.slice(0, 50).join(',');
  const res = await fetch(`/api/presence?ids=${encodeURIComponent(qs)}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to load presence');
  return (data.presence ?? {}) as Record<string, string>;
}

export function toPresenceEntry(lastSeenAt: string | null | undefined): PresenceEntry {
  return {
    lastSeenAt: lastSeenAt ?? null,
    isOnline: isUserOnline(lastSeenAt),
  };
}

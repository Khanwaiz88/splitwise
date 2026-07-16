export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
};

export type DmContact = {
  user_id: string;
  display_name: string;
  email: string;
};

export type ConversationInfo = {
  conversationId: string;
  type: 'group' | 'dm';
  title: string;
  groupId?: string;
  otherUserId?: string;
};

export async function openGroupChat(groupId: string): Promise<ConversationInfo> {
  const res = await fetch(`/api/chat/conversations?type=group&groupId=${encodeURIComponent(groupId)}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to open group chat');
  return data as ConversationInfo;
}

export async function openDmChat(userId: string): Promise<ConversationInfo> {
  const res = await fetch(`/api/chat/conversations?type=dm&userId=${encodeURIComponent(userId)}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to open DM');
  return data as ConversationInfo;
}

export async function fetchDmContacts(): Promise<DmContact[]> {
  const res = await fetch('/api/chat/contacts', { credentials: 'include', cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to load contacts');
  return (data.contacts ?? []) as DmContact[];
}

export async function fetchChatMessages(
  conversationId: string,
  before?: string,
): Promise<ChatMessage[]> {
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  const qs = params.toString();
  const res = await fetch(
    `/api/chat/${conversationId}/messages${qs ? `?${qs}` : ''}`,
    { credentials: 'include', cache: 'no-store' },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to load messages');
  return (data.messages ?? []) as ChatMessage[];
}

export async function sendChatMessage(conversationId: string, body: string): Promise<ChatMessage> {
  const res = await fetch(`/api/chat/${conversationId}/messages`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to send message');
  return data.message as ChatMessage;
}

export type ChatUnreadItem = {
  conversationId: string;
  unreadCount: number;
  type: 'group' | 'dm';
  title: string;
  groupId?: string;
  otherUserId?: string;
};

export async function fetchChatUnread(): Promise<{ total: number; items: ChatUnreadItem[] }> {
  const res = await fetch('/api/chat/unread', { credentials: 'include', cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to load unread messages');
  return data as { total: number; items: ChatUnreadItem[] };
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const res = await fetch('/api/chat/read', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to mark conversation read');
}

export function formatChatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export type AddedMember = {
  id: string;
  email: string;
  display_name: string;
  is_guest?: boolean;
};

export type InviteLink = {
  token: string;
  email: string;
  expiresAt: string;
  joinUrl: string;
  hasAccount?: boolean;
  emailSent?: boolean;
  emailSkipped?: boolean;
  emailError?: string;
};

export type PendingInvite = {
  id: string;
  group_id: string;
  group_name: string;
  invited_by: string;
  inviter_name: string;
  email: string;
  token: string;
  created_at: string;
  expires_at: string;
};

/** Add existing database user to group by email (instant, no invite request) */
export async function addMemberByEmail(groupId: string, email: string): Promise<AddedMember> {
  const res = await fetch('/api/members', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to add member');
  return data as AddedMember;
}

/** Send invite — creates pending invite, optional email delivery */
export async function sendGroupInvite(
  groupId: string,
  email: string,
  options?: { sendEmail?: boolean },
): Promise<InviteLink> {
  const res = await fetch('/api/invites', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, email, sendEmail: options?.sendEmail !== false }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to create invite');
  return data as InviteLink;
}

export async function fetchPendingInvites(): Promise<{ invites: PendingInvite[]; count: number }> {
  const res = await fetch('/api/invites', { credentials: 'include', cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to load invites');
  return data as { invites: PendingInvite[]; count: number };
}

export async function acceptInviteById(inviteId: string): Promise<{
  groupId: string;
  groupName: string;
  email: string;
}> {
  const res = await fetch(`/api/invites/${inviteId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'accept' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to accept invite');
  return data;
}

export async function declineInviteById(inviteId: string): Promise<void> {
  const res = await fetch(`/api/invites/${inviteId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'decline' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to decline invite');
}

export async function acceptGroupInvite(token: string): Promise<{
  groupId: string;
  groupName: string;
  email: string;
}> {
  const res = await fetch('/api/invites/accept', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to accept invite');
  return data;
}

export function inviteLink(token: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/join/${token}`;
  }
  return `/join/${token}`;
}

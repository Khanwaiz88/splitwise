export type AddedMember = {
  id: string;
  email: string;
  display_name: string;
};

export type InviteLink = {
  token: string;
  email: string;
  expiresAt: string;
  joinUrl: string;
};

/** Add existing database user to group by email */
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

/** Create invite link for someone without an account */
export async function sendGroupInvite(groupId: string, email: string): Promise<InviteLink> {
  const res = await fetch('/api/invites', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to create invite');
  return data as InviteLink;
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

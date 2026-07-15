export type AddedMember = {
  id: string;
  email: string;
  display_name: string;
  is_guest?: boolean;
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

/** Add a guest member by display name only (no account required) */
export async function addGuestMemberByName(groupId: string, displayName: string): Promise<AddedMember> {
  const res = await fetch('/api/members', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, displayName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to add guest member');
  return data as AddedMember;
}

/** Remove a member from a group (registered user or guest) */
export async function removeMemberFromGroup(groupId: string, userId: string): Promise<void> {
  const res = await fetch('/api/members', {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, userId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to remove member');
}

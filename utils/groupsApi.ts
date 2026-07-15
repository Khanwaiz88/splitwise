import type { CurrencyCode } from '@/utils/currency';

export type GroupMember = {
  id: string;
  display_name: string;
  email: string;
  is_guest?: boolean;
};

export type GroupResponse = {
  id: string;
  name: string;
  currency?: CurrencyCode;
  created_at?: string;
  memberCount: number;
  members?: GroupMember[];
};

type GroupsListResult = {
  groups: GroupResponse[];
  userId: string;
};

type CreateGroupResult = {
  group: GroupResponse;
};

export async function fetchMyGroups(): Promise<GroupsListResult> {
  const res = await fetch('/api/groups', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? `Failed to fetch groups (${res.status})`);
  }

  return data as GroupsListResult;
}

export async function createGroup(
  name: string,
  currency: CurrencyCode = 'USD',
): Promise<CreateGroupResult> {
  const res = await fetch('/api/groups', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, currency }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? `Failed to create group (${res.status})`);
  }

  return data as CreateGroupResult;
}

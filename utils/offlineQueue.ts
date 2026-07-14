import type { NewExpensePayload, NewSettlementPayload } from '@/utils/dashboardApi';

export type PendingExpense = NewExpensePayload & {
  tempId: string;
  createdAt: string;
};

export type PendingSettlement = NewSettlementPayload & {
  tempId: string;
  createdAt: string;
};

export type PendingGroup = {
  tempId: string;
  name: string;
  createdAt: string;
};

const PENDING_EXPENSES_KEY = 'splitwise_pending_expenses';
const PENDING_SETTLEMENTS_KEY = 'splitwise_pending_settlements';
const PENDING_GROUPS_KEY = 'splitwise_pending_groups';
const ACTIVE_GROUP_KEY = 'splitwise_active_group';
const GROUPS_CACHE_KEY = 'splitwise_groups_cache';
const OFFLINE_KEY = 'splitwise_offline_data_v2';

export function getPendingExpenses(): PendingExpense[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_EXPENSES_KEY);
    return raw ? (JSON.parse(raw) as PendingExpense[]) : [];
  } catch {
    return [];
  }
}

export function addPendingExpense(item: PendingExpense): void {
  const list = getPendingExpenses().filter((p) => p.tempId !== item.tempId);
  list.push(item);
  localStorage.setItem(PENDING_EXPENSES_KEY, JSON.stringify(list));
}

export function removePendingExpense(tempId: string): void {
  const list = getPendingExpenses().filter((p) => p.tempId !== tempId);
  localStorage.setItem(PENDING_EXPENSES_KEY, JSON.stringify(list));
}

export function getPendingSettlements(): PendingSettlement[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_SETTLEMENTS_KEY);
    return raw ? (JSON.parse(raw) as PendingSettlement[]) : [];
  } catch {
    return [];
  }
}

export function addPendingSettlement(item: PendingSettlement): void {
  const list = getPendingSettlements().filter((p) => p.tempId !== item.tempId);
  list.push(item);
  localStorage.setItem(PENDING_SETTLEMENTS_KEY, JSON.stringify(list));
}

export function removePendingSettlement(tempId: string): void {
  const list = getPendingSettlements().filter((p) => p.tempId !== tempId);
  localStorage.setItem(PENDING_SETTLEMENTS_KEY, JSON.stringify(list));
}

export function getPendingGroups(): PendingGroup[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_GROUPS_KEY);
    return raw ? (JSON.parse(raw) as PendingGroup[]) : [];
  } catch {
    return [];
  }
}

export function addPendingGroup(item: PendingGroup): void {
  const list = getPendingGroups().filter((p) => p.tempId !== item.tempId);
  list.push(item);
  localStorage.setItem(PENDING_GROUPS_KEY, JSON.stringify(list));
}

export function removePendingGroup(tempId: string): void {
  const list = getPendingGroups().filter((p) => p.tempId !== tempId);
  localStorage.setItem(PENDING_GROUPS_KEY, JSON.stringify(list));
}

/** Replace temp offline group id with real id across local caches and pending items */
export function remapTempGroupId(tempId: string, realId: string, groupName: string): void {
  if (typeof window === 'undefined') return;

  if (localStorage.getItem(ACTIVE_GROUP_KEY) === tempId) {
    localStorage.setItem(ACTIVE_GROUP_KEY, realId);
  }

  try {
    const raw = localStorage.getItem(GROUPS_CACHE_KEY);
    if (raw) {
      const groups = JSON.parse(raw) as Array<{ id: string; name: string; memberCount?: number }>;
      localStorage.setItem(
        GROUPS_CACHE_KEY,
        JSON.stringify(
          groups.map((g) => (g.id === tempId ? { ...g, id: realId, name: groupName } : g)),
        ),
      );
    }
  } catch { /* ignore */ }

  try {
    const raw = localStorage.getItem(OFFLINE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.groupId === tempId) {
        data.groupId = realId;
        data.groupName = groupName;
        localStorage.setItem(OFFLINE_KEY, JSON.stringify(data));
      }
    }
  } catch { /* ignore */ }

  const expenses = getPendingExpenses().map((p) =>
    p.group_id === tempId ? { ...p, group_id: realId } : p,
  );
  localStorage.setItem(PENDING_EXPENSES_KEY, JSON.stringify(expenses));

  const settlements = getPendingSettlements().map((p) =>
    p.group_id === tempId ? { ...p, group_id: realId } : p,
  );
  localStorage.setItem(PENDING_SETTLEMENTS_KEY, JSON.stringify(settlements));
}

export function initOfflineDashboardForGroup(
  tempId: string,
  groupName: string,
  user: { id: string; email?: string | null; display_name?: string },
): void {
  if (typeof window === 'undefined') return;
  const member = {
    id: user.id,
    display_name: user.display_name?.trim() || user.email?.split('@')[0] || 'You',
    email: user.email ?? '',
  };
  localStorage.setItem(
    OFFLINE_KEY,
    JSON.stringify({
      members: [member],
      expenses: [],
      settlements: [],
      currentUser: { id: user.id, email: user.email ?? null },
      groupId: tempId,
      groupName,
    }),
  );
}

export function isNetworkFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  const cause = String((err as Error & { cause?: unknown }).cause ?? '').toLowerCase();
  return (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('internet') ||
    cause.includes('enotfound') ||
    cause.includes('econnrefused') ||
    cause.includes('etimedout')
  );
}

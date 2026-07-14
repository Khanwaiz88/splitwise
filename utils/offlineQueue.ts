import type { NewExpensePayload, NewSettlementPayload } from '@/utils/dashboardApi';

export type PendingExpense = NewExpensePayload & {
  tempId: string;
  createdAt: string;
};

export type PendingSettlement = NewSettlementPayload & {
  tempId: string;
  createdAt: string;
};

const PENDING_EXPENSES_KEY = 'splitwise_pending_expenses';
const PENDING_SETTLEMENTS_KEY = 'splitwise_pending_settlements';

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

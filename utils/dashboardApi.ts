import type { Expense, Settlement } from '@/utils/splitMath';

export type DashboardData = {
  user: { id: string; email?: string | null };
  groupId: string | null;
  groupName: string | null;
  members: { id: string; display_name: string; email: string }[];
  expenses: Expense[];
  settlements: Settlement[];
};

export async function fetchDashboard(groupId?: string | null): Promise<DashboardData> {
  const qs = groupId ? `?groupId=${encodeURIComponent(groupId)}` : '';
  const res = await fetch(`/api/dashboard${qs}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to load dashboard');
  return data as DashboardData;
}

export type NewExpensePayload = {
  group_id: string;
  description: string;
  amount: number;
  paid_by: string;
  splits: Record<string, number>;
  split_type: 'equal' | 'exact' | 'percentage';
  user_id?: string;
};

/** Fire-and-forget save — caller handles optimistic UI */
export async function saveExpense(payload: NewExpensePayload): Promise<Expense> {
  const res = await fetch('/api/expenses', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to save expense');
  return data.expense as Expense;
}

export type UpdateExpensePayload = {
  description: string;
  amount: number;
  paid_by: string;
  splits: Record<string, number>;
  split_type: 'equal' | 'exact' | 'percentage';
};

export async function updateExpense(expenseId: string, payload: UpdateExpensePayload): Promise<Expense> {
  let res: Response;
  try {
    res = await fetch(`/api/expenses/${expenseId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Network error — check your internet connection.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to update expense');
  return data.expense as Expense;
}

export async function deleteExpense(expenseId: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/expenses/${expenseId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch {
    throw new Error('Network error — check your internet connection.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to delete expense');
}

export type NewSettlementPayload = {
  group_id: string;
  from_user: string;
  to_user: string;
  amount: number;
};

export async function recordSettlement(payload: NewSettlementPayload): Promise<Settlement> {
  let res: Response;
  try {
    res = await fetch('/api/settlements', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Network error — check your internet connection.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to record payment');
  return data.settlement as Settlement;
}

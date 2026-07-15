export type Member = {
  id: string;
  display_name: string;
  email: string;
  is_guest?: boolean;
};

export type Expense = {
  id: string;
  description: string;
  amount: number;
  paid_by: string;
  splits: Record<string, number>;
  split_type: 'equal' | 'exact' | 'percentage';
};

export type Settlement = {
  id: string;
  from: string;
  to: string;
  amount: number;
  created_at?: string;
};

export type Transaction = {
  from: string;
  to: string;
  amount: number;
};

export type UserBalance = {
  userId: string;
  displayName: string;
  netBalance: number;
};

/**
 * Rounds a number to 2 decimal places safely to handle JS floating point inaccuracies.
 */
function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export type ExpenseShare = {
  userId: string;
  displayName: string;
  amount: number;
  detail: string;
};

export function resolveMemberName(
  members: Member[],
  userId: string,
  currentUserId?: string,
): string {
  if (!userId) return 'Unknown';
  if (userId === currentUserId) return 'You';
  const m = members.find((x) => x.id === userId);
  if (!m) return 'Member';
  return m.display_name?.trim() || m.email?.split('@')[0] || 'Member';
}

/** Per-member owed amount for a single expense */
export function getExpenseShares(expense: Expense, members: Member[]): ExpenseShare[] {
  const totalAmount = round2(expense.amount);
  const splitUserIds = Object.keys(expense.splits);
  if (splitUserIds.length === 0) return [];

  const nameOf = (id: string) => resolveMemberName(members, id);

  if (expense.split_type === 'equal') {
    const perPerson = totalAmount / splitUserIds.length;
    let totalDistributed = 0;
    return splitUserIds.map((userId, index) => {
      let amount = round2(perPerson);
      if (index === splitUserIds.length - 1) {
        amount = round2(totalAmount - totalDistributed);
      }
      totalDistributed = round2(totalDistributed + amount);
      return {
        userId,
        displayName: nameOf(userId),
        amount,
        detail: 'Equal split',
      };
    });
  }

  if (expense.split_type === 'percentage') {
    let totalDistributed = 0;
    return splitUserIds.map((userId, index) => {
      const pct = expense.splits[userId];
      let amount = round2((pct / 100) * totalAmount);
      if (index === splitUserIds.length - 1) {
        amount = round2(totalAmount - totalDistributed);
      }
      totalDistributed = round2(totalDistributed + amount);
      return {
        userId,
        displayName: nameOf(userId),
        amount,
        detail: `${pct}%`,
      };
    });
  }

  return splitUserIds.map((userId) => ({
    userId,
    displayName: nameOf(userId),
    amount: round2(expense.splits[userId]),
    detail: 'Exact amount',
  }));
}

/**
 * Calculates the net balance of each user across all expenses.
 * Net Balance = (Total amount paid by user as payer) - (Total amount user owes across all expenses).
 *
 * Positive Net Balance = User is owed money.
 * Negative Net Balance = User owes money.
 */
export function calculateBalances(
  members: Member[],
  expenses: Expense[],
  settlements: Settlement[] = [],
): UserBalance[] {
  const balanceMap = new Map<string, number>();

  // Initialize all members with 0 balance
  members.forEach(m => balanceMap.set(m.id, 0));

  expenses.forEach(expense => {
    const totalAmount = round2(expense.amount);
    
    // Add to payer's balance (they get this money back)
    const currentPayerBalance = balanceMap.get(expense.paid_by) || 0;
    balanceMap.set(expense.paid_by, round2(currentPayerBalance + totalAmount));

    const splitUserIds = Object.keys(expense.splits);
    if (splitUserIds.length === 0) return;

    if (expense.split_type === 'equal') {
      const splitAmount = totalAmount / splitUserIds.length;
      let totalDistributed = 0;
      
      splitUserIds.forEach((userId, index) => {
        let amountToOwe = round2(splitAmount);
        
        // Adjust the last person's share to absorb any rounding differences
        if (index === splitUserIds.length - 1) {
           amountToOwe = round2(totalAmount - totalDistributed);
        }
        totalDistributed = round2(totalDistributed + amountToOwe);
        
        const currentBal = balanceMap.get(userId) || 0;
        balanceMap.set(userId, round2(currentBal - amountToOwe));
      });
      
    } else if (expense.split_type === 'percentage') {
      let totalDistributed = 0;
      
      splitUserIds.forEach((userId, index) => {
        const percentage = expense.splits[userId];
        let amountToOwe = round2((percentage / 100) * totalAmount);
        
        // Adjust the last person's share to absorb any rounding differences
        if (index === splitUserIds.length - 1) {
           amountToOwe = round2(totalAmount - totalDistributed);
        }
        totalDistributed = round2(totalDistributed + amountToOwe);
        
        const currentBal = balanceMap.get(userId) || 0;
        balanceMap.set(userId, round2(currentBal - amountToOwe));
      });
      
    } else if (expense.split_type === 'exact') {
      splitUserIds.forEach(userId => {
        const amountToOwe = round2(expense.splits[userId]);
        const currentBal = balanceMap.get(userId) || 0;
        balanceMap.set(userId, round2(currentBal - amountToOwe));
      });
    }
  });

  // Recorded payments: payer (from) reduces debt, receiver (to) reduces credit
  settlements.forEach((s) => {
    const fromBal = balanceMap.get(s.from) ?? 0;
    const toBal = balanceMap.get(s.to) ?? 0;
    balanceMap.set(s.from, round2(fromBal + s.amount));
    balanceMap.set(s.to, round2(toBal - s.amount));
  });

  return members.map(m => ({
    userId: m.id,
    displayName: m.display_name,
    netBalance: round2(balanceMap.get(m.id) || 0)
  }));
}

/**
 * Calculates the absolute minimum transactions needed to settle all debts in the group.
 * Uses a greedy algorithm with two pointers to match the highest debtors with the highest creditors.
 */
export function minimizeDebts(balances: UserBalance[], members: Member[]): Transaction[] {
  // Debtors owe money (negative balance)
  const debtors = balances
    .filter(b => b.netBalance <= -0.01)
    .map(b => ({ userId: b.userId, amount: Math.abs(b.netBalance) }));
    
  // Creditors are owed money (positive balance)
  const creditors = balances
    .filter(b => b.netBalance >= 0.01)
    .map(b => ({ userId: b.userId, amount: b.netBalance }));

  // Sort descending by amount to settle largest debts first for efficiency
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  let i = 0;
  let j = 0;
  const transactions: Transaction[] = [];

  // Greedy pointer approach
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const amountToSettle = Math.min(debtor.amount, creditor.amount);
    const roundedAmount = round2(amountToSettle);

    if (roundedAmount > 0) {
      transactions.push({
        from: debtor.userId,
        to: creditor.userId,
        amount: roundedAmount
      });
    }

    debtor.amount = round2(debtor.amount - amountToSettle);
    creditor.amount = round2(creditor.amount - amountToSettle);

    // Move pointers if balance is settled (less than 1 cent left)
    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return transactions;
}

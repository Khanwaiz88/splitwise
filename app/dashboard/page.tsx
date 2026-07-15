'use client';

import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { removeMemberFromGroup } from '@/utils/membersApi';
import { fetchDashboard, saveExpense, recordSettlement, deleteExpense } from '@/utils/dashboardApi';
import { getPendingExpenses, removePendingExpense, getPendingSettlements, removePendingSettlement, addPendingSettlement, isNetworkFailure } from '@/utils/offlineQueue';
import { syncPendingGroups } from '@/utils/syncGroups';
import { loadProfileCache, saveProfileCache } from '@/utils/profileCache';
import {
  calculateBalances,
  minimizeDebts,
  resolveMemberName,
  type Member,
  type Expense,
  type Settlement,
  type Transaction,
} from '@/utils/splitMath';
import AddExpenseModal from '@/components/AddExpenseModal';
import ExpenseDetailModal from '@/components/ExpenseDetailModal';
import InviteMember from '@/components/InviteMember';
import GroupMembersList from '@/components/GroupMembersList';
import PageHeader from '@/components/ui/PageHeader';
import WidgetCard from '@/components/ui/WidgetCard';
import {
  RefreshCw, WifiOff, TrendingUp, TrendingDown,
  CheckCircle2, Receipt, Users, Sparkles, Zap, Banknote,
} from 'lucide-react';

const OFFLINE_KEY = 'splitwise_offline_data_v2';
const ACTIVE_GROUP_KEY = 'splitwise_active_group';

function DashboardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const showAddModal = searchParams.get('action') === 'add';
  const hasLoadedOnce = useRef(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('Your Group');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [recordingKey, setRecordingKey] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const loadOfflineData = useCallback(() => {
    try {
      const raw = localStorage.getItem(OFFLINE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      setMembers(d.members ?? []);
      setExpenses(d.expenses ?? []);
      const cachedSettlements = d.settlements ?? [];
      const pendingSettlements = getPendingSettlements().map((p) => ({
        id: p.tempId,
        from: p.from_user,
        to: p.to_user,
        amount: p.amount,
        created_at: p.createdAt,
      }));
      const seen = new Set(cachedSettlements.map((s: Settlement) => s.id));
      setSettlements([
        ...pendingSettlements.filter((s) => !seen.has(s.id)),
        ...cachedSettlements,
      ]);
      setCurrentUser(d.currentUser ?? null);
      setCurrentGroupId(d.groupId ?? null);
      setGroupName(d.groupName ?? 'Your Group');
      return true;
    } catch {
      return false;
    }
  }, []);

  const persistOfflineSnapshot = useCallback((
    patch: Partial<{
      members: Member[];
      expenses: Expense[];
      settlements: Settlement[];
      currentUser: { id: string; email?: string | null } | null;
      groupId: string | null;
      groupName: string;
    }>,
  ) => {
    try {
      const raw = localStorage.getItem(OFFLINE_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      localStorage.setItem(OFFLINE_KEY, JSON.stringify({ ...prev, ...patch }));
    } catch { /* ignore */ }
  }, []);

  const syncPendingSettlements = useCallback(async () => {
    if (!navigator.onLine) return;
    const pending = getPendingSettlements();
    if (pending.length === 0) return;

    for (const item of pending) {
      try {
        const saved = await recordSettlement(item);
        removePendingSettlement(item.tempId);
        setSettlements((prev) => prev.map((s) => (s.id === item.tempId ? saved : s)));
      } catch (err) {
        console.error('[syncPendingSettlements]', err);
      }
    }
  }, []);

  const syncPendingExpenses = useCallback(async () => {
    if (!navigator.onLine) return;
    const pending = getPendingExpenses();
    if (pending.length === 0) return;

    for (const item of pending) {
      try {
        const saved = await saveExpense(item);
        removePendingExpense(item.tempId);
        setExpenses((prev) => prev.map((e) => (e.id === item.tempId ? saved : e)));
      } catch (err) {
        console.error('[syncPendingExpenses]', err);
      }
    }
  }, []);

  const applyData = useCallback((
    data: Awaited<ReturnType<typeof fetchDashboard>>,
  ) => {
    setCurrentUser(data.user);
    setCurrentGroupId(data.groupId);
    setGroupName(data.groupName ?? 'Your Group');
    setMembers(data.members);
    setExpenses(data.expenses);
    const pendingSettlements = getPendingSettlements().map((p) => ({
      id: p.tempId,
      from: p.from_user,
      to: p.to_user,
      amount: p.amount,
      created_at: p.createdAt,
    }));
    setSettlements([...pendingSettlements, ...(data.settlements ?? [])]);
    if (data.groupId) localStorage.setItem(ACTIVE_GROUP_KEY, data.groupId);
    localStorage.setItem(OFFLINE_KEY, JSON.stringify({
      members: data.members,
      expenses: data.expenses,
      settlements: [
        ...getPendingSettlements().map((p) => ({
          id: p.tempId,
          from: p.from_user,
          to: p.to_user,
          amount: p.amount,
          created_at: p.createdAt,
        })),
        ...(data.settlements ?? []),
      ],
      currentUser: data.user,
      groupId: data.groupId,
      groupName: data.groupName,
    }));

    const me = data.members.find((m) => m.id === data.user.id);
    if (me) {
      const existing = loadProfileCache();
      saveProfileCache({
        id: me.id,
        email: me.email,
        display_name: me.display_name,
        created_at: existing?.created_at ?? new Date().toISOString(),
      });
    }
  }, []);

  const loadData = useCallback(async (overrideGroupId?: string, silent = false) => {
    const online = navigator.onLine;
    setIsOffline(!online);

    if (!online) {
      loadOfflineData();
      setIsInitialLoad(false);
      return;
    }

    if (!silent && !hasLoadedOnce.current) setIsInitialLoad(true);
    else if (silent) setIsRefreshing(true);

    try {
      await syncPendingGroups();
      const groupId = overrideGroupId ?? localStorage.getItem(ACTIVE_GROUP_KEY) ?? undefined;

      if (groupId?.startsWith('temp-')) {
        loadOfflineData();
        setIsInitialLoad(false);
        return;
      }

      const data = await fetchDashboard(groupId);
      applyData(data);
      hasLoadedOnce.current = true;

      const pendingBefore = getPendingExpenses().length + getPendingSettlements().length;
      await syncPendingExpenses();
      await syncPendingSettlements();
      const pendingAfter = getPendingExpenses().length + getPendingSettlements().length;
      if (pendingBefore > pendingAfter) {
        const fresh = await fetchDashboard(groupId ?? data.groupId ?? undefined);
        applyData(fresh);
      }
    } catch (err) {
      console.error('[Dashboard]', err);
      setIsOffline(true);
      loadOfflineData();
    } finally {
      setIsInitialLoad(false);
      setIsRefreshing(false);
    }
  }, [applyData, loadOfflineData, syncPendingExpenses, syncPendingSettlements]);

  useEffect(() => {
    loadOfflineData();
    loadData(undefined, false);
    const onOnline = () => {
      setIsOffline(false);
      syncPendingGroups().then(() => {
        syncPendingExpenses();
        syncPendingSettlements();
        loadData(undefined, true);
      });
    };
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [loadData, loadOfflineData, syncPendingExpenses, syncPendingSettlements]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.groupId) loadData(detail.groupId, true);
    };
    window.addEventListener('groupChanged', handler);
    return () => window.removeEventListener('groupChanged', handler);
  }, [loadData]);

  const balances = useMemo(
    () => (members.length > 0 ? calculateBalances(members, expenses, settlements) : []),
    [members, expenses, settlements],
  );

  const transactions = useMemo(
    () => (balances.length > 0 ? minimizeDebts(balances, members) : []),
    [balances, members],
  );

  const handleOptimisticAdd = useCallback((expense: Expense) => {
    setExpenses((prev) => {
      const next = [expense, ...prev];
      persistOfflineSnapshot({ expenses: next });
      return next;
    });
  }, [persistOfflineSnapshot]);

  const handleSaveFailed = useCallback((tempId: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== tempId));
  }, []);

  const handleSaveConfirmed = useCallback((tempId: string, real: Expense) => {
    setExpenses((prev) => prev.map((e) => (e.id === tempId ? real : e)));
  }, []);

  const handleMemberAdded = useCallback((member: Member) => {
    setMembers((prev) => {
      if (prev.some((m) => m.id === member.id)) return prev;
      const next = [...prev, member];
      persistOfflineSnapshot({ members: next });
      return next;
    });
  }, [persistOfflineSnapshot]);

  const handleMemberRemoved = useCallback(async (member: Member) => {
    if (!currentGroupId || currentGroupId.startsWith('temp-')) {
      toast.error('Sync this group online before removing members.');
      return;
    }
    if (!navigator.onLine) {
      toast.error('Connect to the internet to remove a member.');
      return;
    }
    const label = member.display_name || member.email || 'Member';
    if (!window.confirm(`Remove ${label} from this group?`)) return;

    setRemovingMemberId(member.id);
    try {
      await removeMemberFromGroup(currentGroupId, member.id);
      setMembers((prev) => {
        const next = prev.filter((m) => m.id !== member.id);
        persistOfflineSnapshot({ members: next });
        return next;
      });
      toast.success(`${label} removed from group.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setRemovingMemberId(null);
    }
  }, [currentGroupId, persistOfflineSnapshot]);

  const handleExpenseUpdated = useCallback((updated: Expense) => {
    setExpenses((prev) => {
      const next = prev.map((e) => (e.id === updated.id ? updated : e));
      persistOfflineSnapshot({ expenses: next });
      return next;
    });
    setEditingExpense(null);
  }, [persistOfflineSnapshot]);

  const handleDeleteExpense = useCallback(async (expense: Expense) => {
    if (expense.id.startsWith('temp-')) {
      removePendingExpense(expense.id);
      setExpenses((prev) => {
        const next = prev.filter((e) => e.id !== expense.id);
        persistOfflineSnapshot({ expenses: next });
        return next;
      });
      setSelectedExpense(null);
      toast.success('Expense removed.');
      return;
    }
    if (!navigator.onLine) {
      toast.error('Connect to the internet to delete an expense.');
      throw new Error('offline');
    }
    await deleteExpense(expense.id);
    setExpenses((prev) => {
      const next = prev.filter((e) => e.id !== expense.id);
      persistOfflineSnapshot({ expenses: next });
      return next;
    });
    setSelectedExpense(null);
    toast.success('Expense deleted.');
  }, [persistOfflineSnapshot]);

  const myBalance = balances.find((b) => b.userId === currentUser?.id);
  const totalGroupSpend = expenses.reduce((s, e) => s + e.amount, 0);
  const isSettledUp = myBalance ? Math.abs(myBalance.netBalance) < 0.01 : true;
  const memberName = (id: string) => resolveMemberName(members, id, currentUser?.id);

  const balanceAmount = myBalance?.netBalance ?? 0;

  const mySettlements = useMemo(
    () => transactions.filter(
      (tx) => tx.from === currentUser?.id || tx.to === currentUser?.id,
    ),
    [transactions, currentUser?.id],
  );

  const otherBalances = useMemo(
    () => balances
      .filter((b) => Math.abs(b.netBalance) >= 0.01)
      .sort((a, b) => b.netBalance - a.netBalance),
    [balances],
  );

  const formatSettlement = (tx: Transaction) => {
    if (tx.from === currentUser?.id) {
      return {
        headline: `You owe ${memberName(tx.to)}`,
        hint: 'Send this amount to settle up',
        tone: 'owe' as const,
      };
    }
    if (tx.to === currentUser?.id) {
      return {
        headline: `${memberName(tx.from)} owes you`,
        hint: 'They should pay you this amount',
        tone: 'owed' as const,
      };
    }
    return {
      headline: `${memberName(tx.from)} owes ${memberName(tx.to)}`,
      hint: 'Between other members',
      tone: 'other' as const,
    };
  };

  const settlementKey = (tx: Transaction) => `${tx.from}-${tx.to}-${tx.amount}`;

  const handleRecordPayment = useCallback(async (tx: Transaction) => {
    if (!currentGroupId) return;

    const key = settlementKey(tx);
    setRecordingKey(key);

    const tempId = `temp-${Date.now()}`;
    const payload = {
      group_id: currentGroupId,
      from_user: tx.from,
      to_user: tx.to,
      amount: tx.amount,
    };
    const optimistic: Settlement = {
      id: tempId,
      from: tx.from,
      to: tx.to,
      amount: tx.amount,
      created_at: new Date().toISOString(),
    };

    const saveLocally = () => {
      addPendingSettlement({ ...payload, tempId, createdAt: optimistic.created_at! });
      setSettlements((prev) => {
        const next = [optimistic, ...prev];
        persistOfflineSnapshot({ settlements: next });
        return next;
      });
      toast.success('Payment saved offline — will sync when you\'re back online.');
    };

    if (!navigator.onLine) {
      saveLocally();
      setRecordingKey(null);
      return;
    }

    try {
      const saved = await recordSettlement(payload);
      setSettlements((prev) => {
        const next = [saved, ...prev];
        persistOfflineSnapshot({ settlements: next });
        return next;
      });
      toast.success('Payment recorded!');
    } catch (err) {
      if (isNetworkFailure(err)) {
        saveLocally();
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to record payment');
      }
    } finally {
      setRecordingKey(null);
    }
  }, [currentGroupId, persistOfflineSnapshot]);

  const renderSettlementRow = (
    tx: Transaction,
    idx: number,
    delay: number,
    showRecord = true,
  ) => {
    const { headline, hint, tone } = formatSettlement(tx);
    const isMine = tx.from === currentUser?.id || tx.to === currentUser?.id;
    const key = settlementKey(tx);
    const isRecording = recordingKey === key;

    return (
      <div
        key={`${tx.from}-${tx.to}-${idx}`}
        className={`list-row animate-fade-in-up flex-col sm:flex-row sm:items-center gap-3 ${isMine ? 'list-row-active' : ''} ${tone === 'owe' ? 'border-rose-500/20' : tone === 'owed' ? 'border-lime-500/20' : ''}`}
        style={{ animationDelay: `${delay}ms`, opacity: 0 }}
      >
        <div className="min-w-0 flex-1 w-full">
          <p className={`text-sm font-bold truncate ${tone === 'owe' ? 'text-rose-200' : tone === 'owed' ? 'text-lime-200' : 'text-white/80'}`}>
            {headline}
          </p>
          <p className="text-xs text-white/40 mt-0.5">{hint}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
          <span className={`text-sm font-extrabold ${tone === 'owe' ? 'text-rose-300' : tone === 'owed' ? 'text-lime-300' : 'gradient-text'}`}>
            ${tx.amount.toFixed(2)}
          </span>
          {showRecord && (
            <button
              type="button"
              onClick={() => handleRecordPayment(tx)}
              disabled={isRecording}
              className="text-xs font-bold px-3 py-2 rounded-lg bg-lime-500/15 text-lime-200 border border-lime-500/30 hover:bg-lime-500/25 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {isRecording ? 'Saving…' : 'Record payment'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={groupName}
        title="Dashboard"
        icon={Sparkles}
        action={
          <button
            onClick={() => loadData(undefined, true)}
            aria-label="Refresh"
            className="p-3 rounded-xl glass-light border border-white/10 text-white/50 hover:text-white hover:border-violet-500/40 transition-all"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        }
      />

      {isOffline && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3.5 text-amber-100 text-sm">
          <WifiOff size={16} className="shrink-0" />
          <span>Offline — viewing cached data. New expenses save locally and sync when online.</span>
        </div>
      )}

      {/* Bento stats */}
      <div className="bento-grid animate-fade-in-up delay-1">
        <div className="bento-hero widget widget-violet overflow-hidden relative min-h-[140px]">
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-violet-500/25 blur-3xl" />
          <div className="absolute right-4 bottom-4 w-24 h-24 rounded-full border border-violet-400/20 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-violet-400/30 animate-spin-slow" />
          </div>
          <div className="relative z-10 p-1">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-300/70 mb-2">Total Group Spend</p>
            <p className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              ${totalGroupSpend.toFixed(2)}
            </p>
            <p className="text-sm text-white/45 mt-2 font-medium">
              {expenses.length} expense{expenses.length !== 1 ? 's' : ''} · {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className={`stat-pill ${isSettledUp ? 'border-lime-500/30 bg-lime-500/5' : balanceAmount > 0 ? 'border-lime-500/30 bg-lime-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}>
          <div className="stat-pill-label">
            {isSettledUp ? <CheckCircle2 size={14} className="text-lime-400" /> : balanceAmount > 0 ? <TrendingUp size={14} className="text-lime-400" /> : <TrendingDown size={14} className="text-rose-400" />}
            Your Balance
          </div>
          <p className={`stat-pill-value ${isSettledUp ? 'text-white/80' : balanceAmount > 0 ? 'text-lime-300' : 'text-rose-300'}`}>
            {balanceAmount > 0 ? '+' : ''}${balanceAmount.toFixed(2)}
          </p>
          <p className="stat-pill-hint">
            {isSettledUp ? 'All settled up' : balanceAmount > 0 ? 'Owed to you' : 'You owe'}
          </p>
        </div>

        <div className="stat-pill border-cyan-500/30 bg-cyan-500/5">
          <div className="stat-pill-label">
            <Users size={14} className="text-cyan-400" /> Members
          </div>
          <p className="stat-pill-value text-cyan-100">{members.length}</p>
          <p className="stat-pill-hint">in this group</p>
        </div>

        <div className="stat-pill border-amber-500/30 bg-amber-500/5 sm:col-span-2">
          <div className="stat-pill-label">
            <Zap size={14} className="text-amber-400" /> Pending Settlements
          </div>
          <p className="stat-pill-value text-amber-100">{transactions.length}</p>
          <p className="stat-pill-hint">
            {transactions.length === 0 ? 'Everyone is square' : `${transactions.length} payment${transactions.length !== 1 ? 's' : ''} to clear`}
          </p>
        </div>
      </div>

      {/* Your debts — Splitwise style */}
      {!isInitialLoad && members.length > 0 && (
        <section className="page-section animate-fade-in-up delay-2">
          <h2 className="section-title">
            <span className="section-title-icon bg-violet-500/15 text-violet-300 border border-violet-500/25">
              <TrendingDown size={16} />
            </span>
            {isSettledUp ? 'Your Status' : balanceAmount > 0 ? 'You Get Back' : 'You Owe'}
          </h2>

          {isSettledUp ? (
            <WidgetCard variant="lime" delay={180} hover={false} className="text-center py-6">
              <CheckCircle2 size={36} className="text-lime-400/70 mx-auto mb-2" />
              <p className="text-white font-bold">You are settled up!</p>
              <p className="text-white/40 text-xs mt-1">No one owes you and you owe no one.</p>
            </WidgetCard>
          ) : mySettlements.length > 0 ? (
            <div className="card-list">
              {mySettlements.map((tx, idx) => renderSettlementRow(tx, idx, 180 + idx * 60))}
            </div>
          ) : (
            <WidgetCard variant="violet" delay={180} hover={false} className="py-4 px-4">
              <p className={`text-lg font-extrabold ${balanceAmount > 0 ? 'text-lime-300' : 'text-rose-300'}`}>
                {balanceAmount > 0 ? '+' : ''}${balanceAmount.toFixed(2)} overall
              </p>
              <p className="text-xs text-white/45 mt-1">
                {balanceAmount > 0 ? 'Total owed to you in this group' : 'Total you owe in this group'}
              </p>
            </WidgetCard>
          )}
        </section>
      )}

      {/* Group balances — har member ka net balance */}
      {!isInitialLoad && otherBalances.length > 0 && (
        <section className="page-section animate-fade-in-up delay-2">
          <h2 className="section-title">
            <span className="section-title-icon bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/25">
              <Users size={16} />
            </span>
            Group Balances
          </h2>
          <p className="text-xs text-white/40 -mt-2 mb-3">
            + means they paid extra · − means they owe their share
          </p>
          <div className="card-list">
            {otherBalances.map((b, idx) => {
              const isYou = b.userId === currentUser?.id;
              const positive = b.netBalance > 0;
              return (
                <div
                  key={b.userId}
                  className={`list-row animate-fade-in-up ${isYou ? 'list-row-active' : ''}`}
                  style={{ animationDelay: `${200 + idx * 50}ms`, opacity: 0 }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {isYou ? 'You' : memberName(b.userId)}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {positive ? 'gets back' : 'owes group'}
                    </p>
                  </div>
                  <span className={`text-sm font-extrabold ml-3 shrink-0 ${positive ? 'text-lime-300' : 'text-rose-300'}`}>
                    {positive ? '+' : ''}${Math.abs(b.netBalance).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Settlements */}
      <section className="page-section animate-fade-in-up delay-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">
            <span className="section-title-icon bg-amber-500/15 text-amber-300 border border-amber-500/25">
              <Zap size={16} />
            </span>
            Settlements
          </h2>
          {transactions.length > 0 && (
            <span className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full font-bold border border-amber-500/30">
              {transactions.length} payment{transactions.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-xs text-white/40 -mt-2 mb-3">
          Minimum payments to clear all debts — like Splitwise settle up
        </p>

        {isInitialLoad && members.length === 0 ? (
          <div className="card-list">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 widget animate-shimmer rounded-2xl" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <WidgetCard variant="lime" delay={240} hover={false} className="text-center py-8 md:py-10">
            <CheckCircle2 size={40} className="text-lime-400/60 mx-auto mb-3 animate-bounce-in" />
            <p className="text-white font-bold">All settled up!</p>
            <p className="text-white/40 text-xs mt-1">No outstanding debts in this group.</p>
          </WidgetCard>
        ) : (
          <div className="card-list">
            {transactions.map((tx, idx) => renderSettlementRow(tx, idx, 240 + idx * 60))}
          </div>
        )}
      </section>

      {/* Payment history — recorded settle-ups */}
      {!isInitialLoad && settlements.length > 0 && (
        <section className="page-section animate-fade-in-up delay-4">
          <h2 className="section-title">
            <span className="section-title-icon bg-lime-500/15 text-lime-300 border border-lime-500/25">
              <Banknote size={16} />
            </span>
            Payment History
          </h2>
          <p className="text-xs text-white/40 -mt-2 mb-3">
            Recorded payments that reduced group debts
          </p>
          <div className="card-list">
            {settlements.slice(0, 10).map((s, idx) => {
              const headline = `${memberName(s.from)} paid ${memberName(s.to)}`;
              const date = s.created_at
                ? new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : '';
              return (
                <div
                  key={s.id}
                  className="list-row animate-fade-in-up"
                  style={{ animationDelay: `${300 + idx * 50}ms`, opacity: 0 }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{headline}</p>
                    {date && <p className="text-xs text-white/40 mt-0.5">{date}</p>}
                  </div>
                  <span className="text-sm font-extrabold text-lime-300 ml-3 shrink-0">
                    ${s.amount.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent expenses */}
      <section className="page-section animate-fade-in-up delay-4">
        <h2 className="section-title">
          <span className="section-title-icon bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/25">
            <Receipt size={16} />
          </span>
          Recent Expenses
        </h2>
        {expenses.length === 0 ? (
          <WidgetCard variant="fuchsia" delay={300} hover={false} className="text-center py-8 md:py-10">
            <Receipt size={40} className="text-fuchsia-400/40 mx-auto mb-3" />
            <p className="text-white font-bold">No expenses yet</p>
            <p className="text-white/40 text-xs mt-1">Tap Add to record your first expense.</p>
          </WidgetCard>
        ) : (
          <div className="card-list">
            {expenses.slice(0, 8).map((exp, idx) => (
              <button
                key={exp.id}
                type="button"
                onClick={() => setSelectedExpense(exp)}
                className="list-row animate-fade-in-up w-full text-left cursor-pointer hover:border-fuchsia-500/30 hover:bg-fuchsia-500/5 transition-colors"
                style={{ animationDelay: `${300 + idx * 50}ms`, opacity: 0 }}
              >
                <div className="min-w-0 flex items-center gap-3">
                  <span className="icon-badge bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 border border-fuchsia-500/25 text-fuchsia-300 text-xs font-bold">
                    $
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{exp.description}</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {memberName(exp.paid_by)} · <span className="capitalize">{exp.split_type}</span>
                    </p>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-white ml-3 shrink-0">${exp.amount.toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {currentGroupId && members.length > 0 && (
        <section className="animate-fade-in-up delay-5">
          <GroupMembersList
            members={members}
            currentUserId={currentUser?.id}
            canManage={!isOffline && !!currentGroupId && !currentGroupId.startsWith('temp-')}
            removingId={removingMemberId}
            onRemove={handleMemberRemoved}
          />
        </section>
      )}

      {currentGroupId && currentUser && !currentGroupId.startsWith('temp-') && (
        <section className="animate-fade-in-up delay-6">
          <InviteMember
            groupId={currentGroupId}
            currentUserId={currentUser.id}
            existingMemberIds={members.map((m) => m.id)}
            existingMemberNames={members.map((m) => m.display_name)}
            onMemberAdded={handleMemberAdded}
          />
        </section>
      )}

      <AddExpenseModal
        isOpen={showAddModal || !!editingExpense}
        editExpense={editingExpense}
        members={members}
        currentUser={currentUser}
        groupId={currentGroupId}
        groupName={groupName}
        onClose={() => {
          if (editingExpense) setEditingExpense(null);
          else router.replace('/dashboard');
        }}
        onOptimisticAdd={handleOptimisticAdd}
        onSaveFailed={handleSaveFailed}
        onSaveConfirmed={handleSaveConfirmed}
        onExpenseUpdated={handleExpenseUpdated}
      />

      <ExpenseDetailModal
        expense={selectedExpense}
        members={members}
        currentUserId={currentUser?.id}
        groupName={groupName}
        onClose={() => setSelectedExpense(null)}
        onEdit={(expense) => {
          setSelectedExpense(null);
          setEditingExpense(expense);
        }}
        onDelete={handleDeleteExpense}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="page-stack">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 widget animate-shimmer rounded-2xl" />
        ))}
      </div>
    }>
      <DashboardInner />
    </Suspense>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import type { Expense, Member } from '@/utils/splitMath';
import { saveExpense, updateExpense } from '@/utils/dashboardApi';
import { addPendingExpense } from '@/utils/offlineQueue';
import ModalPortal from '@/components/ui/ModalPortal';
import { X, Receipt, Sparkles, Users, FolderOpen } from 'lucide-react';
import { avatarGradient } from '@/utils/avatarColor';
import { formatMoney, type CurrencyCode, DEFAULT_CURRENCY } from '@/utils/currency';

type SplitType = 'equal' | 'exact' | 'percentage';

type Props = {
  isOpen: boolean;
  members: Member[];
  currentUser: { id: string } | null;
  groupId: string | null;
  groupName?: string;
  currency?: CurrencyCode;
  editExpense?: Expense | null;
  onClose?: () => void;
  onOptimisticAdd?: (expense: Expense) => void;
  onSaveFailed?: (tempId: string) => void;
  onSaveConfirmed?: (tempId: string, realExpense: Expense) => void;
  onExpenseUpdated?: (expense: Expense) => void;
};

function memberLabel(m: Member, currentUserId?: string) {
  return m.id === currentUserId ? 'You' : (m.display_name || m.email || 'Member');
}

export default function AddExpenseModal({
  isOpen, members, currentUser, groupId, groupName = 'Your Group',
  currency = DEFAULT_CURRENCY,
  editExpense = null,
  onClose,
  onOptimisticAdd, onSaveFailed, onSaveConfirmed, onExpenseUpdated,
}: Props) {
  const router = useRouter();
  const isEditMode = !!editExpense;
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [splits, setSplits] = useState<Record<string, string>>({});
  const [loadedMembers, setLoadedMembers] = useState<Member[]>(members);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoadedMembers(members);
  }, [members]);

  useEffect(() => {
    if (!isOpen || !groupId) return;

    setLoadingMembers(true);
    fetch(`/api/groups/${groupId}/members`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.members?.length) setLoadedMembers(data.members);
      })
      .catch(() => { /* dashboard members used as fallback */ })
      .finally(() => setLoadingMembers(false));
  }, [isOpen, groupId]);

  useEffect(() => {
    if (!isOpen) return;
    if (editExpense) {
      setDescription(editExpense.description);
      setAmount(String(editExpense.amount));
      setPaidBy(editExpense.paid_by);
      setSplitType(editExpense.split_type);
      const splitStrings: Record<string, string> = {};
      Object.entries(editExpense.splits).forEach(([id, val]) => {
        splitStrings[id] = String(val);
      });
      loadedMembers.forEach((m) => {
        if (!(m.id in splitStrings)) splitStrings[m.id] = '';
      });
      setSplits(splitStrings);
      return;
    }
    setDescription('');
    setAmount('');
    setPaidBy(currentUser?.id ?? loadedMembers[0]?.id ?? '');
    setSplitType('equal');
    const initial: Record<string, string> = {};
    loadedMembers.forEach((m) => { initial[m.id] = ''; });
    setSplits(initial);
  }, [isOpen, editExpense, loadedMembers, currentUser]);

  const handleClose = useCallback(() => {
    if (onClose) onClose();
    else router.replace('/dashboard');
  }, [onClose, router]);

  const percentSum = loadedMembers.reduce((s, m) => s + Number(splits[m.id] ?? 0), 0);
  const exactSum = loadedMembers.reduce((s, m) => s + Number(splits[m.id] ?? 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId) { toast.error('No active group — select a group from the sidebar first.'); return; }
    if (loadedMembers.length === 0) { toast.error('Add members to this group before adding expenses.'); return; }
    if (!paidBy) { toast.error('Select who paid for this expense.'); return; }
    const totalAmount = parseFloat(amount);
    if (!description.trim() || isNaN(totalAmount) || totalAmount <= 0) {
      toast.error('Please enter a valid description and amount.');
      return;
    }

    const parsedSplits: Record<string, number> = {};
    if (splitType === 'equal') {
      loadedMembers.forEach((m) => { parsedSplits[m.id] = 1; });
    } else {
      for (const m of loadedMembers) {
        const val = parseFloat(splits[m.id] ?? '0');
        if (isNaN(val) || val < 0) { toast.error(`Invalid value for ${m.display_name}.`); return; }
        parsedSplits[m.id] = val;
      }
      if (splitType === 'exact' && Math.abs(exactSum - totalAmount) > 0.01) {
        toast.error(`Exact splits must total ${formatMoney(totalAmount, currency)}.`);
        return;
      }
      if (splitType === 'percentage' && Math.abs(percentSum - 100) > 0.01) {
        toast.error('Percentages must equal 100%.');
        return;
      }
    }

    const payload = {
      description: description.trim(),
      amount: totalAmount,
      paid_by: paidBy,
      splits: parsedSplits,
      split_type: splitType,
    };

    if (isEditMode && editExpense) {
      if (!navigator.onLine) {
        toast.error('Connect to the internet to edit an expense.');
        return;
      }
      if (editExpense.id.startsWith('temp-')) {
        toast.error('Wait until this expense syncs online before editing.');
        return;
      }
      setSaving(true);
      try {
        const updated = await updateExpense(editExpense.id, payload);
        onExpenseUpdated?.(updated);
        handleClose();
        toast.success('Expense updated!');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update expense');
      } finally {
        setSaving(false);
      }
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimistic: Expense = {
      id: tempId,
      description: payload.description,
      amount: totalAmount,
      paid_by: paidBy,
      splits: parsedSplits,
      split_type: splitType,
    };

    onOptimisticAdd?.(optimistic);
    handleClose();

    const createPayload = {
      group_id: groupId,
      ...payload,
      user_id: currentUser?.id,
    };

    if (!navigator.onLine) {
      addPendingExpense({ ...createPayload, tempId, createdAt: new Date().toISOString() });
      toast.success('Saved offline — will sync when you\'re back online.');
      return;
    }

    toast.success('Expense added!');

    saveExpense(createPayload)
      .then((saved) => onSaveConfirmed?.(tempId, saved))
      .catch((err) => {
        onSaveFailed?.(tempId);
        toast.error(err.message ?? 'Failed to save expense.');
      });
  };

  return (
    <ModalPortal open={isOpen} onClose={handleClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-sheet widget widget-flush widget-violet rounded-2xl border border-violet-500/30 shadow-2xl shadow-violet-500/25 animate-modal-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-expense-title"
      >
        <div className="modal-header">
          <div className="flex items-center gap-3 min-w-0">
            <span className="icon-badge bg-violet-500/20 border border-violet-400/30 text-violet-200 shrink-0">
              <Receipt size={18} />
            </span>
            <h2 id="add-expense-title" className="text-lg font-extrabold text-white truncate">
              {isEditMode ? 'Edit Expense' : 'Add Expense'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl glass-light border border-white/10 text-white/50 hover:text-white shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="flex items-center gap-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 mb-5">
            <span className="icon-badge bg-violet-500/20 border border-violet-400/30 text-violet-200 shrink-0">
              <FolderOpen size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300/70">Adding to group</p>
              <p className="text-sm font-extrabold text-white truncate">{groupName}</p>
              <p className="text-xs text-white/45 mt-0.5">
                {loadingMembers ? 'Loading members…' : `${loadedMembers.length} member${loadedMembers.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          {!groupId && (
            <div className="alert-banner alert-banner-amber mb-4">
              No group selected. Pick a group from the sidebar first.
            </div>
          )}

          {groupId && !loadingMembers && loadedMembers.length === 0 && (
            <div className="alert-banner alert-banner-amber mb-4">
              No members in this group. Add members from the dashboard first.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-field">
              <label className="form-label" htmlFor="expense-desc">Description</label>
              <input
                id="expense-desc"
                type="text"
                required
                autoFocus
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Dinner, Groceries, Uber"
                className="input-field py-3.5"
              />
            </div>

            <div className="form-row-2">
              <div className="form-field">
                <label className="form-label" htmlFor="expense-amount">Amount ({currency})</label>
                <input
                  id="expense-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="input-field py-3.5 text-xl font-extrabold"
                />
              </div>
            </div>

            <div className="form-field">
              <label className="form-label">Paid by — who paid this bill?</label>
              {loadingMembers ? (
                <div className="h-12 rounded-xl widget animate-shimmer" />
              ) : loadedMembers.length === 0 ? (
                <p className="text-sm text-white/40 px-1">No members to select.</p>
              ) : (
                <div className="space-y-2">
                  {loadedMembers.map((m) => {
                    const selected = paidBy === m.id;
                    const grad = avatarGradient(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaidBy(m.id)}
                        className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all ${
                          selected
                            ? 'border-violet-400/50 bg-violet-500/15 shadow-lg shadow-violet-500/10'
                            : 'border-white/10 bg-white/[0.03] hover:border-violet-500/30 hover:bg-violet-500/5'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center shrink-0`}>
                          <Users size={14} className="text-white" />
                        </div>
                        <span className={`text-sm font-bold truncate ${selected ? 'text-white' : 'text-white/70'}`}>
                          {memberLabel(m, currentUser?.id)}
                        </span>
                        {selected && (
                          <span className="ml-auto text-[10px] font-extrabold text-violet-300 bg-violet-500/20 px-2 py-0.5 rounded-full border border-violet-500/30 shrink-0">
                            Payer
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="form-field">
              <label className="form-label">Split type</label>
              <div className="split-toggle">
                {(['equal', 'exact', 'percentage'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSplitType(t)}
                    className={`split-toggle-btn ${splitType === t ? 'split-toggle-btn-active' : ''}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {splitType !== 'equal' && loadedMembers.length > 0 && (
              <div className="split-panel">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="form-label mb-0">
                      {splitType === 'exact' ? 'Exact amounts' : 'Percentages'}
                    </p>
                    <p className="text-[11px] text-white/40 mt-1">
                      {splitType === 'exact'
                        ? 'Enter how much each member owes'
                        : 'Enter each member\'s share (must total 100%)'}
                    </p>
                  </div>
                  <span className={`text-xs font-extrabold shrink-0 ${
                    splitType === 'percentage'
                      ? Math.abs(percentSum - 100) < 0.01 ? 'text-lime-300' : 'text-rose-300'
                      : Math.abs(exactSum - parseFloat(amount || '0')) < 0.01 ? 'text-lime-300' : 'text-rose-300'
                  }`}>
                    {splitType === 'percentage'
                      ? `${percentSum.toFixed(1)}% / 100%`
                      : `${formatMoney(exactSum, currency)} / ${formatMoney(parseFloat(amount || '0'), currency)}`}
                  </span>
                </div>
                {loadedMembers.map((m) => {
                  const grad = avatarGradient(m.id);
                  const label = memberLabel(m, currentUser?.id);
                  return (
                    <div key={m.id} className="split-member-card">
                      <div className="split-member-card-header">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center shrink-0`}>
                          <span className="text-[10px] font-extrabold text-white">
                            {label.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white truncate">{label}</p>
                          {m.email && (
                            <p className="text-[11px] text-white/40 truncate">{m.email}</p>
                          )}
                        </div>
                      </div>
                      {splitType === 'exact' ? (
                        <div className="input-group">
                          <span className="input-group-icon text-sm font-bold">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={splits[m.id] ?? ''}
                            onChange={(e) => setSplits((prev) => ({ ...prev, [m.id]: e.target.value }))}
                            placeholder="0.00"
                            aria-label={`Exact amount for ${label}`}
                            className="input-group-field py-2.5 text-sm"
                          />
                        </div>
                      ) : (
                        <div className="input-group">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={splits[m.id] ?? ''}
                            onChange={(e) => setSplits((prev) => ({ ...prev, [m.id]: e.target.value }))}
                            placeholder="0"
                            aria-label={`Percentage for ${label}`}
                            className="input-group-field py-2.5 text-sm text-right"
                          />
                          <span className="input-group-suffix">%</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="submit"
              disabled={!groupId || loadedMembers.length === 0 || !paidBy || loadingMembers || saving}
              className="w-full btn-gradient py-3.5 rounded-xl font-extrabold text-base flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles size={18} />
              {saving ? 'Saving…' : isEditMode ? 'Update Expense' : 'Save Expense'}
            </button>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

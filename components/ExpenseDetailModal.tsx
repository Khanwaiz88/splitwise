'use client';

import { useState } from 'react';
import type { Expense, Member } from '@/utils/splitMath';
import { getExpenseShares, resolveMemberName } from '@/utils/splitMath';
import ModalPortal from '@/components/ui/ModalPortal';
import { avatarGradient } from '@/utils/avatarColor';
import { X, Receipt, Users, Wallet, PieChart, Pencil, Trash2 } from 'lucide-react';

type Props = {
  expense: Expense | null;
  members: Member[];
  currentUserId?: string;
  groupName?: string;
  onClose: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
};

export default function ExpenseDetailModal({
  expense,
  members,
  currentUserId,
  groupName,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!expense) return null;

  const shares = getExpenseShares(expense, members);
  const payerName = resolveMemberName(members, expense.paid_by, currentUserId);
  const splitLabel =
    expense.split_type === 'equal'
      ? 'Split equally'
      : expense.split_type === 'exact'
        ? 'Exact amounts'
        : 'By percentage';
  const isPending = expense.id.startsWith('temp-');

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(expense);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <ModalPortal open={!!expense} onClose={onClose}>
      <div
        className="modal-sheet widget widget-flush widget-fuchsia rounded-2xl border border-fuchsia-500/30 shadow-2xl shadow-fuchsia-500/20 animate-modal-pop max-w-md"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-detail-title"
      >
        <div className="modal-header">
          <div className="flex items-center gap-3 min-w-0">
            <span className="icon-badge bg-fuchsia-500/20 border border-fuchsia-400/30 text-fuchsia-200 shrink-0">
              <Receipt size={18} />
            </span>
            <h2 id="expense-detail-title" className="text-lg font-extrabold text-white truncate">
              Expense Details
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl glass-light border border-white/10 text-white/50 hover:text-white shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body space-y-5">
          {groupName && (
            <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-300/60">
              {groupName}
            </p>
          )}

          {isPending && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-100">
              Pending sync — will upload when you&apos;re back online.
            </div>
          )}

          <div className="text-center py-2">
            <p className="text-xl font-extrabold text-white">{expense.description}</p>
            <p className="text-4xl font-extrabold gradient-text mt-2">
              ${expense.amount.toFixed(2)}
            </p>
            <p className="text-sm text-white/45 mt-2">Total amount</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300/70 flex items-center gap-1.5">
                <Wallet size={12} /> Paid by
              </p>
              <p className="text-sm font-extrabold text-white mt-1.5 truncate">{payerName}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300/70 flex items-center gap-1.5">
                <PieChart size={12} /> Split
              </p>
              <p className="text-sm font-extrabold text-white mt-1.5 capitalize truncate">{splitLabel}</p>
            </div>
          </div>

          <div>
            <p className="form-label mb-3">Who owes what</p>
            <div className="space-y-2.5">
              {shares.map((share) => {
                const grad = avatarGradient(share.userId);
                const isPayer = share.userId === expense.paid_by;
                return (
                  <div
                    key={share.userId}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3"
                  >
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center shrink-0`}>
                      <Users size={14} className="text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">
                        {share.displayName === 'You' || share.userId === currentUserId ? 'You' : share.displayName}
                        {isPayer && (
                          <span className="ml-2 text-[10px] font-extrabold text-lime-300 bg-lime-500/15 px-1.5 py-0.5 rounded-full border border-lime-500/30">
                            Paid
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">{share.detail}</p>
                    </div>
                    <p className="text-sm font-extrabold text-white shrink-0">
                      ${share.amount.toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {shares.length > 0 && (
            <div className="flex items-center justify-between text-xs text-white/45 px-1 pt-1 border-t border-white/8">
              <span>Split total</span>
              <span className="font-bold text-white/70">
                ${shares.reduce((s, x) => s + x.amount, 0).toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            {!confirmDelete ? (
              <>
                <button
                  type="button"
                  onClick={() => { onClose(); onEdit(expense); }}
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm bg-violet-500/15 text-violet-200 border border-violet-500/30 hover:bg-violet-500/25 disabled:opacity-50 transition-colors"
                >
                  <Pencil size={16} /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
                >
                  <Trash2 size={16} /> Delete
                </button>
              </>
            ) : (
              <div className="w-full space-y-2.5">
                <p className="text-sm text-rose-200 text-center font-semibold">Delete this expense permanently?</p>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="flex-1 py-3 rounded-xl font-bold text-sm border border-white/15 text-white/70 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 py-3 rounded-xl font-bold text-sm bg-rose-500/20 text-rose-200 border border-rose-500/40 hover:bg-rose-500/30 disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

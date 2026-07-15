'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import {
  acceptInviteById,
  declineInviteById,
  fetchPendingInvites,
  type PendingInvite,
} from '@/utils/invitesApi';
import PageHeader from '@/components/ui/PageHeader';
import WidgetCard from '@/components/ui/WidgetCard';
import { Inbox, Users, Loader2, Check, X, Mail, Clock } from 'lucide-react';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function InvitesPage() {
  const router = useRouter();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!navigator.onLine) {
      setLoading(false);
      return;
    }
    try {
      const { invites: rows } = await fetchPendingInvites();
      setInvites(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load invites');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const notifyChanged = () => {
    window.dispatchEvent(new CustomEvent('invitesChanged'));
  };

  const handleAccept = async (invite: PendingInvite) => {
    setActingId(invite.id);
    try {
      const result = await acceptInviteById(invite.id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      localStorage.setItem('splitwise_active_group', result.groupId);
      notifyChanged();
      toast.success(`Joined "${result.groupName}"!`);
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept invite');
    } finally {
      setActingId(null);
    }
  };

  const handleDecline = async (invite: PendingInvite) => {
    if (!window.confirm(`Decline invite to "${invite.group_name}"?`)) return;
    setActingId(invite.id);
    try {
      await declineInviteById(invite.id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      notifyChanged();
      toast.success('Invite declined.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to decline invite');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Notifications"
        title="Group Invites"
        icon={Inbox}
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 widget animate-shimmer rounded-2xl" />
          ))}
        </div>
      ) : invites.length === 0 ? (
        <WidgetCard variant="violet" hover={false} className="text-center py-14">
          <Inbox size={48} className="text-violet-400/40 mx-auto mb-4" />
          <p className="text-white font-bold text-lg">No pending invites</p>
          <p className="text-white/45 text-sm mt-2 max-w-xs mx-auto">
            When someone invites you to a group, it will appear here and in your email.
          </p>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="mt-6 text-sm font-bold text-violet-300 hover:text-violet-200"
          >
            Go to Dashboard →
          </button>
        </WidgetCard>
      ) : (
        <div className="card-list">
          {invites.map((invite, idx) => {
            const busy = actingId === invite.id;
            return (
              <WidgetCard
                key={invite.id}
                variant="fuchsia"
                delay={idx * 60}
                hover={false}
              >
                <div className="flex items-start gap-4">
                  <span className="icon-badge bg-fuchsia-500/20 border border-fuchsia-400/30 text-fuchsia-200 shrink-0">
                    <Users size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-extrabold text-white truncate">
                      {invite.group_name}
                    </h3>
                    <p className="text-sm text-white/50 mt-1">
                      <strong className="text-white/70">{invite.inviter_name}</strong> invited you
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-white/40">
                      <span className="flex items-center gap-1">
                        <Mail size={12} /> {invite.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {relativeTime(invite.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 mt-5">
                  <button
                    type="button"
                    onClick={() => handleAccept(invite)}
                    disabled={!!actingId}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl btn-gradient font-extrabold text-sm disabled:opacity-50"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecline(invite)}
                    disabled={!!actingId}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 font-bold text-sm hover:bg-rose-500/15 disabled:opacity-50"
                  >
                    <X size={16} /> Decline
                  </button>
                </div>
              </WidgetCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  Activity, WifiOff, RefreshCw, Clock, Receipt,
  UserPlus, Inbox, Sparkles, Banknote,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';

const ACTIVE_GROUP_KEY = 'splitwise_active_group';
const ACTIVITY_CACHE_KEY = 'splitwise_activity_cache';

type LogEntry = {
  id: string;
  description: string;
  created_at: string;
  user_id: string;
  actorName?: string;
};

type FilterType = 'all' | 'expenses' | 'payments';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function logType(description: string): 'expense' | 'payment' | 'member' | 'other' {
  const d = description.toLowerCase();
  if (d.includes('deleted expense') || d.includes('updated expense')) return 'expense';
  if (d.includes('expense')) return 'expense';
  if (d.includes(' paid ')) return 'payment';
  if (d.includes('joined') || d.includes('added') || d.includes('member')) return 'member';
  return 'other';
}

const ICON_CONFIG = [
  { type: 'expense' as const, icon: Receipt, color: 'from-fuchsia-500 to-violet-500', border: 'border-fuchsia-500/30' },
  { type: 'payment' as const, icon: Banknote, color: 'from-lime-500 to-emerald-500', border: 'border-lime-500/30' },
  { type: 'member' as const, icon: UserPlus, color: 'from-cyan-500 to-sky-500', border: 'border-cyan-500/30' },
  { type: 'other' as const, icon: Activity, color: 'from-amber-500 to-orange-500', border: 'border-amber-500/30' },
];

function getIconConfig(description: string) {
  const t = logType(description);
  return ICON_CONFIG.find((c) => c.type === t)!;
}

function SkeletonRow() {
  return (
    <div className="flex gap-4 animate-pulse">
      <div className="w-10 h-10 rounded-xl widget animate-shimmer shrink-0" />
      <div className="pb-8 flex-1 space-y-2 pt-1">
        <div className="h-3.5 w-3/4 widget animate-shimmer rounded-full" />
        <div className="h-3 w-1/3 widget animate-shimmer rounded-full" />
      </div>
    </div>
  );
}

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'payments', label: 'Payments' },
];

export default function ActivityPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('Your Group');
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  const loadActivity = useCallback(async (gid?: string) => {
    setIsLoading(true);
    const online = navigator.onLine;
    setIsOffline(!online);
    const resolvedGroupId = gid ?? localStorage.getItem(ACTIVE_GROUP_KEY);
    setGroupId(resolvedGroupId);

    if (!resolvedGroupId) { setIsLoading(false); return; }

    if (!online) {
      try {
        const raw = localStorage.getItem(ACTIVITY_CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached.groupId === resolvedGroupId) {
            setLogs(cached.logs ?? []);
            setGroupName(cached.groupName ?? 'Your Group');
          }
        }
      } catch { /* ignore */ }
      setIsLoading(false);
      return;
    }

    try {
      const { data: groupRow } = await supabase.from('groups').select('name').eq('id', resolvedGroupId).single();
      const currentName = groupRow?.name ?? 'Your Group';
      setGroupName(currentName);

      const { data: logRows, error } = await supabase
        .from('activity_log')
        .select('id, description, created_at, user_id')
        .eq('group_id', resolvedGroupId)
        .order('created_at', { ascending: false })
        .limit(60);

      if (error) throw error;
      const rows = logRows ?? [];
      const uniqueUserIds = [...new Set(rows.map((r: { user_id: string }) => r.user_id))];
      let profileMap: Record<string, string> = {};

      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, display_name, email').in('id', uniqueUserIds);
        (profiles ?? []).forEach((p: { id: string; display_name?: string; email?: string }) => {
          profileMap[p.id] = p.display_name ?? p.email ?? 'Someone';
        });
      }

      const enriched: LogEntry[] = rows.map((r: { id: string; description: string; created_at: string; user_id: string }) => ({
        id: r.id,
        description: r.description,
        created_at: r.created_at,
        user_id: r.user_id,
        actorName: profileMap[r.user_id] ?? 'Someone',
      }));

      setLogs(enriched);
      try {
        localStorage.setItem(ACTIVITY_CACHE_KEY, JSON.stringify({ groupId: resolvedGroupId, groupName: currentName, logs: enriched }));
      } catch { /* ignore */ }
    } catch (err) {
      console.error('[Activity]', err);
      setIsOffline(true);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadActivity();
    const onOnline = () => { setIsOffline(false); loadActivity(); };
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [loadActivity]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.groupId) loadActivity(detail.groupId);
    };
    window.addEventListener('groupChanged', handler);
    return () => window.removeEventListener('groupChanged', handler);
  }, [loadActivity]);

  const filteredLogs = useMemo(() => {
    if (filter === 'all') return logs;
    if (filter === 'expenses') return logs.filter((l) => logType(l.description) === 'expense');
    return logs.filter((l) => logType(l.description) === 'payment');
  }, [logs, filter]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={groupName}
        title="Activity"
        icon={Activity}
        action={
          <button onClick={() => loadActivity()} disabled={isLoading} aria-label="Refresh"
            className="p-3 rounded-xl glass-light border border-white/10 text-white/50 hover:text-white hover:border-violet-500/40 transition-all disabled:opacity-50">
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {isOffline && (
        <div className="widget widget-amber px-4 py-3 text-amber-200 text-sm flex items-center gap-2">
          <WifiOff size={16} /> Offline — cached activity.
        </div>
      )}

      {groupId && (
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`text-xs font-bold px-3.5 py-2 rounded-full border transition-colors ${
                filter === f.id
                  ? 'bg-violet-500/25 text-violet-200 border-violet-500/40'
                  : 'bg-white/5 text-white/45 border-white/10 hover:border-white/20'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {!groupId && !isLoading && (
        <div className="widget text-center py-12">
          <Sparkles size={36} className="text-violet-400/30 mx-auto mb-3" />
          <p className="text-white font-bold">No group selected</p>
          <p className="text-white/40 text-xs mt-1">Switch to a group to see activity.</p>
        </div>
      )}

      {groupId && (
        <div className="widget widget-lg">
          {isLoading && (
            <div>{[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}</div>
          )}

          {!isLoading && filteredLogs.length === 0 && (
            <div className="py-12 text-center">
              <Inbox size={40} className="text-violet-400/30 mx-auto mb-4 animate-float" />
              <p className="text-white font-bold">
                {filter === 'payments' ? 'No payments recorded yet' : filter === 'expenses' ? 'No expenses yet' : 'No activity yet'}
              </p>
              <p className="text-white/40 text-xs mt-1">
                {filter === 'payments'
                  ? 'Record a settle-up payment from the dashboard.'
                  : 'Events appear when expenses or payments are added.'}
              </p>
            </div>
          )}

          {!isLoading && filteredLogs.length > 0 && (
            <div>
              {filteredLogs.map((log, idx) => {
                const isLast = idx === filteredLogs.length - 1;
                const cfg = getIconConfig(log.description);
                const Icon = cfg.icon;
                return (
                  <div key={log.id} className="flex gap-4 animate-fade-in-up" style={{ animationDelay: `${idx * 50}ms`, opacity: 0 }}>
                    <div className="flex flex-col items-center shrink-0">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cfg.color} flex items-center justify-center border ${cfg.border} shadow-lg`}>
                        <Icon size={16} className="text-white" />
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-gradient-to-b from-violet-500/30 to-transparent mt-2 min-h-[24px]" />}
                    </div>
                    <div className={`pb-6 flex-1 min-w-0 ${isLast ? 'pb-2' : ''}`}>
                      <p className="text-sm font-semibold text-white/90 leading-snug">{log.description}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Clock size={11} className="text-violet-400/50 shrink-0" />
                        <span className="text-xs text-white/40 font-medium">{relativeTime(log.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!isLoading && filteredLogs.length > 0 && (
        <p className="text-center text-xs text-white/30 font-medium">
          {filteredLogs.length} event{filteredLogs.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

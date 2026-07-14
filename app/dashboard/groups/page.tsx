'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { fetchMyGroups, createGroup, type GroupResponse } from '@/utils/groupsApi';
import {
  addPendingGroup,
  getPendingGroups,
  initOfflineDashboardForGroup,
  isNetworkFailure,
} from '@/utils/offlineQueue';
import { resolveOfflineProfile } from '@/utils/profileCache';
import { syncPendingGroups } from '@/utils/syncGroups';
import {
  Users, Plus, Check, RefreshCw,
  FolderOpen, ArrowRight, WifiOff, ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import WidgetCard from '@/components/ui/WidgetCard';
import GroupMembersList from '@/components/GroupMembersList';
import { avatarGradient } from '@/utils/avatarColor';

const ACTIVE_GROUP_KEY = 'splitwise_active_group';
const GROUPS_CACHE_KEY = 'splitwise_groups_cache';

const GROUP_COLORS = ['violet', 'fuchsia', 'cyan', 'amber', 'rose', 'lime'] as const;

export default function GroupsPage() {
  const router = useRouter();
  const hasLoadedOnce = useRef(false);

  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [loadingMembersId, setLoadingMembersId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const loadGroups = useCallback(async (silent = false) => {
    if (!silent && !hasLoadedOnce.current && groups.length === 0) setIsInitialLoad(true);
    setFetchError('');
    const online = navigator.onLine;
    setIsOffline(!online);
    if (!online) { setIsInitialLoad(false); return; }

    try {
      await syncPendingGroups();
      const { groups: fetchedGroups, userId } = await fetchMyGroups();
      setGroups(fetchedGroups);
      setCurrentUserId(userId);
      localStorage.setItem(GROUPS_CACHE_KEY, JSON.stringify(fetchedGroups));
      hasLoadedOnce.current = true;
      const savedActive = localStorage.getItem(ACTIVE_GROUP_KEY) ?? fetchedGroups[0]?.id ?? null;
      setActiveGroupId(savedActive);
      if (savedActive) localStorage.setItem(ACTIVE_GROUP_KEY, savedActive);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load groups';
      setFetchError(message);
      if (!groups.length) toast.error(message);
    } finally {
      setIsInitialLoad(false);
    }
  }, [groups.length]);

  useEffect(() => {
    let hasCache = false;
    try {
      const raw = localStorage.getItem(GROUPS_CACHE_KEY);
      if (raw) { setGroups(JSON.parse(raw)); hasCache = true; }
      const saved = localStorage.getItem(ACTIVE_GROUP_KEY);
      if (saved) setActiveGroupId(saved);
    } catch { /* ignore */ }
    setMounted(true);
    loadGroups(hasCache);
    const onOnline = () => { setIsOffline(false); loadGroups(true); };
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [loadGroups]);

  const selectGroup = (group: GroupResponse) => {
    setActiveGroupId(group.id);
    localStorage.setItem(ACTIVE_GROUP_KEY, group.id);
    window.dispatchEvent(new CustomEvent('groupChanged', { detail: { groupId: group.id } }));
    router.push('/dashboard');
  };

  const handleToggleMembers = useCallback(async (group: GroupResponse) => {
    if (expandedGroupId === group.id) {
      setExpandedGroupId(null);
      return;
    }

    setExpandedGroupId(group.id);

    const hasMembers = (group.members?.length ?? 0) > 0;
    if (hasMembers || group.memberCount <= 0) return;

    setLoadingMembersId(group.id);
    try {
      const res = await fetch(`/api/groups/${group.id}/members`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load members');

      setGroups((prev) =>
        prev.map((g) =>
          g.id === group.id
            ? { ...g, members: data.members ?? [], memberCount: data.members?.length ?? g.memberCount }
            : g,
        ),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoadingMembersId(null);
    }
  }, [expandedGroupId]);

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newGroupName.trim();
    if (!name) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic: GroupResponse = { id: tempId, name, memberCount: 1 };
    const nextGroups = [optimistic, ...groups];

    setGroups(nextGroups);
    setActiveGroupId(tempId);
    setNewGroupName('');
    localStorage.setItem(GROUPS_CACHE_KEY, JSON.stringify(nextGroups));
    localStorage.setItem(ACTIVE_GROUP_KEY, tempId);
    window.dispatchEvent(new CustomEvent('groupChanged', { detail: { groupId: tempId } }));

    const finishCreate = () => {
      router.push('/dashboard');
    };

    if (!navigator.onLine) {
      const profile = resolveOfflineProfile();
      if (!profile?.id) {
        toast.error('Open the app online once before creating groups offline.');
        setGroups(groups);
        return;
      }
      addPendingGroup({ tempId, name, createdAt: new Date().toISOString() });
      initOfflineDashboardForGroup(tempId, name, {
        id: profile.id,
        email: profile.email,
        display_name: profile.display_name,
      });
      toast.success(`Group "${name}" saved offline — will sync when online.`);
      finishCreate();
      return;
    }

    toast.success(`Group "${name}" created!`);
    finishCreate();

    createGroup(name)
      .then(({ group: newGroup }) => {
        const updated = nextGroups.map((g) => (g.id === tempId ? newGroup : g));
        setGroups(updated);
        localStorage.setItem(GROUPS_CACHE_KEY, JSON.stringify(updated));
        setActiveGroupId(newGroup.id);
        localStorage.setItem(ACTIVE_GROUP_KEY, newGroup.id);
        window.dispatchEvent(new CustomEvent('groupChanged', { detail: { groupId: newGroup.id } }));
      })
      .catch((err) => {
        if (isNetworkFailure(err)) {
          const profile = resolveOfflineProfile();
          if (profile?.id) {
            addPendingGroup({ tempId, name, createdAt: new Date().toISOString() });
            initOfflineDashboardForGroup(tempId, name, {
              id: profile.id,
              email: profile.email,
              display_name: profile.display_name,
            });
            toast.success(`Group "${name}" saved offline — will sync when online.`);
            return;
          }
        }
        setGroups((prev) => prev.filter((g) => g.id !== tempId));
        localStorage.setItem(GROUPS_CACHE_KEY, JSON.stringify(groups));
        toast.error(err instanceof Error ? err.message : 'Failed to create group.');
      });
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Management"
        title="My Groups"
        icon={Users}
        action={
          <button onClick={() => loadGroups(true)} aria-label="Refresh"
            className="p-3 rounded-xl glass-light border border-white/10 text-white/50 hover:text-white hover:border-violet-500/40 transition-all">
            <RefreshCw size={18} />
          </button>
        }
      />

      {fetchError && !isOffline && (
        <div className="alert-banner alert-banner-rose">{fetchError}</div>
      )}

      {isOffline && (
        <div className="alert-banner alert-banner-amber">
          <WifiOff size={16} className="shrink-0" />
          <span>Offline — cached list. New groups save locally and sync when online.</span>
        </div>
      )}

      <WidgetCard variant="violet" delay={60} hover={false}>
          <div className="flex items-center gap-3 mb-5">
            <span className="icon-badge bg-violet-500/20 border border-violet-400/30 text-violet-200">
              <Sparkles size={18} />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-white">Create New Group</h2>
              <p className="text-xs text-white/45 mt-0.5">Trip, home, friends — anything shared</p>
            </div>
          </div>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div className="form-field">
              <label className="form-label" htmlFor="group-name">Group name</label>
              <input
                id="group-name"
                type="text"
                required
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g. Vacation Trip, Shared House"
                className="input-field py-3.5"
              />
            </div>
            <button
              type="submit"
              disabled={!newGroupName.trim()}
              className="w-full btn-gradient py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus size={18} /> Create Group
            </button>
          </form>
        </WidgetCard>

      <section className="page-section">
        <h2 className="section-title">
          <span className="section-title-icon bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
            <Users size={16} />
          </span>
          Your Groups
        </h2>

        {(!mounted || isInitialLoad) && groups.length === 0 ? (
          <div className="card-list">
            {[1, 2, 3].map((i) => <div key={i} className="h-28 widget animate-shimmer rounded-2xl" />)}
          </div>
        ) : groups.length === 0 ? (
          <WidgetCard variant="fuchsia" delay={120} hover={false} className="text-center py-12">
            <FolderOpen size={44} className="text-fuchsia-400/40 mx-auto mb-4" />
            <p className="text-white font-bold text-lg">No groups yet</p>
            <p className="text-white/45 text-sm mt-2">Create your first group above to get started.</p>
          </WidgetCard>
        ) : (
          <div className="card-list">
            {groups.map((group, idx) => {
              const isActive = group.id === activeGroupId;
              const isExpanded = expandedGroupId === group.id;
              const color = GROUP_COLORS[idx % GROUP_COLORS.length];
              const grad = avatarGradient(group.id);
              return (
                <div
                  key={group.id}
                  className={`widget widget-${color} animate-fade-in-up`}
                  style={{ animationDelay: `${120 + idx * 80}ms`, opacity: 0 }}
                >
                  <button
                    type="button"
                    onClick={() => selectGroup(group)}
                    className="group-card-main"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-lg shrink-0`}>
                        <span className="text-xl font-extrabold text-white">{group.name[0]?.toUpperCase()}</span>
                      </div>
                      <div className="min-w-0 text-left">
                        <h3 className="font-extrabold text-white truncate text-base">{group.name}</h3>
                        <p className="text-sm text-white/45 mt-1 font-medium">
                          {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-lime-300 bg-lime-500/15 px-3.5 py-2 rounded-full border border-lime-500/30">
                          <Check size={13} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white/50 bg-white/5 px-3.5 py-2 rounded-full">
                          Open <ArrowRight size={13} />
                        </span>
                      )}
                    </div>
                  </button>

                  <div className="group-card-footer">
                    <button
                      type="button"
                      onClick={() => handleToggleMembers(group)}
                      className="w-full flex items-center justify-between gap-3 py-3 px-4 rounded-xl glass-light border border-white/10 text-sm font-semibold text-white/55 hover:text-white transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <Users size={16} className="text-violet-300" />
                        {loadingMembersId === group.id
                          ? 'Loading members…'
                          : isExpanded
                            ? 'Hide members'
                            : 'View members'}
                      </span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {isExpanded && (
                      <div className="mt-4 animate-fade-in-up">
                        {loadingMembersId === group.id ? (
                          <div className="space-y-2.5">
                            {[1, 2, 3].map((i) => (
                              <div key={i} className="h-14 rounded-xl widget animate-shimmer" />
                            ))}
                          </div>
                        ) : (
                          <GroupMembersList
                            members={group.members ?? []}
                            currentUserId={currentUserId ?? undefined}
                            compact
                            embedded
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

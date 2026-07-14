'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { fetchMyGroups, createGroup, type GroupResponse } from '@/utils/groupsApi';
import ModalPortal from '@/components/ui/ModalPortal';
import { ChevronDown, Plus, Check, X, Sparkles } from 'lucide-react';

type Group = Pick<GroupResponse, 'id' | 'name'>;

const ACTIVE_GROUP_KEY = 'splitwise_active_group';
const GROUPS_CACHE_KEY = 'splitwise_groups_cache';

export default function GroupSwitcher({ userId }: { userId: string }) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasLoadedOnce = useRef(false);

  const [mounted, setMounted] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const fetchGroups = useCallback(async (silent = false) => {
    if (!silent && !hasLoadedOnce.current) setIsInitialLoad(true);
    if (!navigator.onLine) { setIsInitialLoad(false); return; }

    try {
      const { groups: fetched } = await fetchMyGroups();
      const mapped: Group[] = fetched.map((g) => ({ id: g.id, name: g.name }));
      setGroups(mapped);
      // Keep full group data (incl. members) for groups page — don't strip cache
      localStorage.setItem(GROUPS_CACHE_KEY, JSON.stringify(fetched));
      hasLoadedOnce.current = true;

      const savedId = localStorage.getItem(ACTIVE_GROUP_KEY);
      const saved = mapped.find((g) => g.id === savedId) ?? mapped[0] ?? null;
      if (saved) {
        setActiveGroup(saved);
        localStorage.setItem(ACTIVE_GROUP_KEY, saved.id);
      }
    } catch (err) {
      console.error('[GroupSwitcher]', err);
    } finally {
      setIsInitialLoad(false);
    }
  }, [userId]);

  useEffect(() => {
    let hasCache = false;
    try {
      const raw = localStorage.getItem(GROUPS_CACHE_KEY);
      if (raw) {
        const cached: Group[] = JSON.parse(raw);
        setGroups(cached);
        hasCache = cached.length > 0;
        const savedId = localStorage.getItem(ACTIVE_GROUP_KEY);
        const saved = cached.find((g) => g.id === savedId) ?? cached[0] ?? null;
        if (saved) setActiveGroup(saved);
      }
    } catch { /* ignore */ }
    setMounted(true);
    fetchGroups(hasCache);
  }, [fetchGroups]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const switchGroup = (group: Group) => {
    setActiveGroup(group);
    localStorage.setItem(ACTIVE_GROUP_KEY, group.id);
    setShowDropdown(false);
    window.dispatchEvent(new CustomEvent('groupChanged', { detail: { groupId: group.id } }));
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.groupId) {
        const found = groups.find((g) => g.id === detail.groupId);
        if (found) setActiveGroup(found);
        fetchGroups(true);
      }
    };
    window.addEventListener('groupChanged', handler);
    return () => window.removeEventListener('groupChanged', handler);
  }, [fetchGroups, groups]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newGroupName.trim();
    if (!name) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic: Group = { id: tempId, name };

    setGroups((prev) => [optimistic, ...prev]);
    setShowCreateModal(false);
    setNewGroupName('');
    switchGroup(optimistic);
    toast.success(`Group "${name}" created!`);

    createGroup(name)
      .then(({ group: newGroup }) => {
        setGroups((prev) => prev.map((g) => (g.id === tempId ? newGroup : g)));
        switchGroup(newGroup);
      })
      .catch((err) => {
        setGroups((prev) => prev.filter((g) => g.id !== tempId));
        toast.error(err.message ?? 'Failed to create group.');
      });
  };

  if (!mounted || (isInitialLoad && groups.length === 0)) {
    return <div className="h-11 w-full rounded-xl widget animate-shimmer" />;
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-full flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl glass-light border border-violet-500/25 hover:border-violet-400/40 text-sm text-white transition-all hover:shadow-lg hover:shadow-violet-500/10"
        >
          <span className="truncate font-bold">{activeGroup?.name ?? 'No Group'}</span>
          <ChevronDown size={14} className={`text-violet-300 shrink-0 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showDropdown && (
          <div className="mt-2 glass border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto animate-fade-in">
            {groups.length === 0 ? (
              <p className="px-3.5 py-3 text-xs text-white/40">No groups yet</p>
            ) : (
              groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => switchGroup(g)}
                  className="w-full flex items-center justify-between px-3.5 py-3 text-sm hover:bg-violet-500/10 transition-colors text-left border-b border-white/5 last:border-0"
                >
                  <span className="truncate text-white/80 font-semibold">{g.name}</span>
                  {activeGroup?.id === g.id && <Check size={14} className="text-violet-300 shrink-0" />}
                </button>
              ))
            )}
            <button
              type="button"
              onClick={() => { setShowDropdown(false); setShowCreateModal(true); }}
              className="w-full flex items-center gap-2 px-3.5 py-3 text-sm font-bold text-violet-300 hover:bg-violet-500/10 transition-colors border-t border-white/5"
            >
              <Plus size={14} /> Create New Group
            </button>
          </div>
        )}
      </div>

      <ModalPortal open={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <div
          className="modal-sheet widget widget-flush widget-violet rounded-2xl border border-violet-500/30 shadow-2xl shadow-violet-500/25 animate-modal-pop"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-group-title"
        >
          <div className="modal-header">
            <div className="flex items-center gap-3">
              <span className="icon-badge bg-violet-500/20 border border-violet-400/30 text-violet-200">
                <Sparkles size={18} />
              </span>
              <h3 id="new-group-title" className="font-extrabold text-white text-lg">New Group</h3>
            </div>
            <button type="button" onClick={() => setShowCreateModal(false)} className="p-2 rounded-xl glass-light border border-white/10 text-white/50 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <div className="modal-body">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="form-field">
                <label className="form-label" htmlFor="new-group-name">Group name</label>
                <input
                  id="new-group-name"
                  type="text"
                  autoFocus
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Weekend Trip, Apartment"
                  className="input-field py-3.5"
                />
              </div>
              <button type="submit" disabled={!newGroupName.trim()} className="w-full btn-gradient py-3.5 rounded-xl font-extrabold disabled:opacity-50">
                Create Group
              </button>
            </form>
          </div>
        </div>
      </ModalPortal>
    </>
  );
}

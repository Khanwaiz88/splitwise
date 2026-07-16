'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Users, User } from 'lucide-react';
import { toast } from 'react-hot-toast';
import PageHeader from '@/components/ui/PageHeader';
import WidgetCard from '@/components/ui/WidgetCard';
import ChatPanel from '@/components/chat/ChatPanel';
import { avatarGradient } from '@/utils/avatarColor';
import {
  fetchDmContacts,
  openDmChat,
  openGroupChat,
  type ConversationInfo,
  type DmContact,
} from '@/utils/chatApi';
import { resolveOfflineProfile } from '@/utils/profileCache';
import { createClient } from '@/utils/supabase/client';

const ACTIVE_GROUP_KEY = 'splitwise_active_group';
const GROUPS_CACHE_KEY = 'splitwise_groups_cache';

type Tab = 'group' | 'dm';

function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ChatPage() {
  const [tab, setTab] = useState<Tab>('group');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('Group');
  const [groupConversation, setGroupConversation] = useState<ConversationInfo | null>(null);
  const [contacts, setContacts] = useState<DmContact[]>([]);
  const [dmConversation, setDmConversation] = useState<ConversationInfo | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDm, setLoadingDm] = useState(false);

  const [currentUserId, setCurrentUserId] = useState('');
  const [currentDisplayName, setCurrentDisplayName] = useState('You');

  useEffect(() => {
    const cached = resolveOfflineProfile();
    if (cached) {
      setCurrentUserId(cached.id);
      setCurrentDisplayName(
        cached.display_name?.trim() || cached.email?.split('@')[0] || 'You',
      );
    }
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setCurrentUserId(data.user.id);
        const name =
          cached?.display_name?.trim() ||
          data.user.email?.split('@')[0] ||
          'You';
        setCurrentDisplayName(name);
      }
    })();
  }, []);

  const resolveActiveGroup = useCallback(() => {
    const savedId = localStorage.getItem(ACTIVE_GROUP_KEY);
    try {
      const raw = localStorage.getItem(GROUPS_CACHE_KEY);
      const groups = raw ? JSON.parse(raw) as Array<{ id: string; name: string }> : [];
      const active = groups.find((g) => g.id === savedId) ?? groups[0] ?? null;
      if (active) {
        setGroupId(active.id);
        setGroupName(active.name);
      } else {
        setGroupId(null);
        setGroupName('No group selected');
      }
    } catch {
      setGroupId(savedId);
    }
  }, []);

  const loadGroupChat = useCallback(async (gid: string) => {
    try {
      const conv = await openGroupChat(gid);
      setGroupConversation(conv);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open group chat');
      setGroupConversation(null);
    }
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      const rows = await fetchDmContacts();
      setContacts(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load contacts');
    }
  }, []);

  const openContact = useCallback(async (userId: string) => {
    setSelectedContactId(userId);
    setLoadingDm(true);
    try {
      const conv = await openDmChat(userId);
      setDmConversation(conv);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open chat');
      setDmConversation(null);
    } finally {
      setLoadingDm(false);
    }
  }, []);

  useEffect(() => {
    resolveActiveGroup();
    setLoading(false);

    const onGroupChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ groupId: string }>).detail;
      if (detail?.groupId) {
        setGroupId(detail.groupId);
        try {
          const raw = localStorage.getItem(GROUPS_CACHE_KEY);
          const groups = raw ? JSON.parse(raw) as Array<{ id: string; name: string }> : [];
          const g = groups.find((x) => x.id === detail.groupId);
          if (g) setGroupName(g.name);
        } catch { /* ignore */ }
      } else {
        resolveActiveGroup();
      }
    };

    window.addEventListener('groupChanged', onGroupChanged);
    return () => window.removeEventListener('groupChanged', onGroupChanged);
  }, [resolveActiveGroup]);

  useEffect(() => {
    if (groupId && tab === 'group') {
      loadGroupChat(groupId);
    }
  }, [groupId, tab, loadGroupChat]);

  useEffect(() => {
    if (tab === 'dm') {
      loadContacts();
    }
  }, [tab, loadContacts]);

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Messages" title="Chat" icon={MessageSquare} />

      <div className="flex gap-2 p-1 rounded-xl glass-light border border-white/10">
        <button
          type="button"
          onClick={() => setTab('group')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
            tab === 'group' ? 'btn-gradient shadow-md' : 'text-white/45 hover:text-white/70'
          }`}
        >
          <Users size={16} /> Group
        </button>
        <button
          type="button"
          onClick={() => setTab('dm')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
            tab === 'dm' ? 'btn-gradient shadow-md' : 'text-white/45 hover:text-white/70'
          }`}
        >
          <User size={16} /> DM
        </button>
      </div>

      {tab === 'group' && !groupId && !loading && (
        <WidgetCard variant="violet" hover={false} className="text-center py-12">
          <MessageSquare size={40} className="text-violet-400/40 mx-auto mb-3" />
          <p className="text-white font-bold">No group selected</p>
          <p className="text-white/45 text-sm mt-2">Create or select a group from the sidebar first.</p>
        </WidgetCard>
      )}

      {tab === 'group' && groupId && groupConversation && currentUserId && (
        <div className="h-[calc(100dvh-14rem)] min-h-[420px] max-h-[720px]">
          <ChatPanel
            conversation={{ ...groupConversation, title: groupName }}
            currentUserId={currentUserId}
            currentDisplayName={currentDisplayName}
          />
        </div>
      )}

      {tab === 'dm' && (
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 min-h-[420px] h-[calc(100dvh-14rem)] max-h-[720px]">
          <div className="widget widget-fuchsia widget-flush overflow-hidden flex flex-col min-h-[180px] md:min-h-0">
            <div className="shrink-0 px-4 py-3 border-b border-white/10">
              <p className="text-xs font-extrabold text-white/50 uppercase tracking-wider">People</p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
              {contacts.length === 0 ? (
                <p className="text-xs text-white/40 text-center py-6 px-2">
                  No contacts yet. Join a group with other members to DM them.
                </p>
              ) : (
                contacts.map((c) => {
                  const active = selectedContactId === c.user_id;
                  const grad = avatarGradient(c.user_id);
                  return (
                    <button
                      key={c.user_id}
                      type="button"
                      onClick={() => openContact(c.user_id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                        active
                          ? 'bg-violet-500/20 border border-violet-500/30'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center shrink-0`}>
                        <span className="text-[10px] font-extrabold text-white">
                          {profileInitials(c.display_name)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{c.display_name}</p>
                        <p className="text-[10px] text-white/40 truncate">{c.email}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="min-h-[320px] md:min-h-0">
            {!selectedContactId || loadingDm ? (
              <WidgetCard variant="violet" hover={false} className="h-full flex items-center justify-center text-center py-12">
                <MessageSquare size={40} className="text-violet-400/40 mx-auto mb-3" />
                <p className="text-white font-bold">
                  {loadingDm ? 'Opening chat…' : 'Select someone to message'}
                </p>
              </WidgetCard>
            ) : dmConversation && currentUserId ? (
              <div className="h-full">
                <ChatPanel
                  conversation={dmConversation}
                  currentUserId={currentUserId}
                  currentDisplayName={currentDisplayName}
                />
              </div>
            ) : null}
          </div>
        </div>
      )}

      {tab === 'group' && groupId && !groupConversation && !loading && (
        <WidgetCard variant="violet" hover={false} className="text-center py-12">
          <p className="text-white/50 text-sm">Could not load group chat.</p>
        </WidgetCard>
      )}
    </div>
  );
}

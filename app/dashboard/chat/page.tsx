'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Users, User, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import PageHeader from '@/components/ui/PageHeader';
import WidgetCard from '@/components/ui/WidgetCard';
import ChatPanel from '@/components/chat/ChatPanel';
import { avatarGradient } from '@/utils/avatarColor';
import { fetchMyGroups } from '@/utils/groupsApi';
import {
  fetchDmContacts,
  openDmChat,
  openGroupChat,
  type ConversationInfo,
  type DmContact,
} from '@/utils/chatApi';
import { useChatUnread } from '@/utils/useChatUnread';
import { usePresence } from '@/utils/usePresence';
import { PresenceDot } from '@/components/chat/PresenceIndicator';
import { presenceStatusLabel } from '@/utils/presenceApi';
import { resolveOfflineProfile } from '@/utils/profileCache';
import { createClient } from '@/utils/supabase/client';

type Tab = 'group' | 'dm';
type GroupItem = { id: string; name: string; memberCount: number };

function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function groupInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'G';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function isSetupError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes('does not exist') || m.includes('function') || m.includes('relation') || m.includes('conversations');
}

export default function ChatPage() {
  const [tab, setTab] = useState<Tab>('group');
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupConversation, setGroupConversation] = useState<ConversationInfo | null>(null);
  const [groupError, setGroupError] = useState('');
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingGroupChat, setLoadingGroupChat] = useState(false);

  const [contacts, setContacts] = useState<DmContact[]>([]);
  const [dmConversation, setDmConversation] = useState<ConversationInfo | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingDm, setLoadingDm] = useState(false);

  const [currentUserId, setCurrentUserId] = useState('');
  const [currentDisplayName, setCurrentDisplayName] = useState('You');
  const { unreadForGroup, unreadForUser } = useChatUnread();
  const contactIds = contacts.map((c) => c.user_id);
  const { get: getPresence } = usePresence(contactIds);
  const chatConversationOpen = Boolean(selectedGroupId || selectedContactId);

  useEffect(() => {
    document.documentElement.classList.toggle('chat-conversation-open', chatConversationOpen);
    return () => document.documentElement.classList.remove('chat-conversation-open');
  }, [chatConversationOpen]);

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

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const { groups: fetched } = await fetchMyGroups();
      const mapped = fetched.map((g) => ({
        id: g.id,
        name: g.name,
        memberCount: g.memberCount,
      }));
      setGroups(mapped);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load groups');
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const openGroup = useCallback(async (gid: string) => {
    setSelectedGroupId(gid);
    setGroupConversation(null);
    setGroupError('');
    setLoadingGroupChat(true);
    try {
      const conv = await openGroupChat(gid);
      setGroupConversation(conv);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to open group chat';
      setGroupError(msg);
      setGroupConversation(null);
      if (!isSetupError(msg)) toast.error(msg);
    } finally {
      setLoadingGroupChat(false);
    }
  }, []);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const rows = await fetchDmContacts();
      setContacts(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load contacts';
      toast.error(msg);
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  const openContact = useCallback(async (userId: string) => {
    setSelectedContactId(userId);
    setLoadingDm(true);
    setDmConversation(null);
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
    if (tab === 'group') loadGroups();
  }, [tab, loadGroups]);

  useEffect(() => {
    if (tab === 'dm') loadContacts();
  }, [tab, loadContacts]);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const setupHint = (
    <WidgetCard variant="amber" hover={false} className="text-left">
      <div className="flex gap-3">
        <AlertCircle className="text-amber-300 shrink-0 mt-0.5" size={22} />
        <div>
          <p className="text-amber-100 font-bold text-sm">Chat database not ready</p>
          <p className="text-amber-200/70 text-xs mt-2 leading-relaxed">
            The chat tables have not been created yet. Run migration{' '}
            <code className="text-amber-100">20260716140000_chat.sql</code> in the
            Supabase Dashboard → SQL Editor, or run{' '}
            <code className="text-amber-100">npm run db:push</code> locally.
          </p>
        </div>
      </div>
    </WidgetCard>
  );

  return (
    <div className="page-stack chat-page-stack">
      <div className={chatConversationOpen ? 'max-md:hidden' : undefined}>
        <PageHeader eyebrow="Messages" title="Chat" icon={MessageSquare} />
      </div>

      <div
        className={`flex gap-2 p-1 rounded-xl glass-light border border-white/10${chatConversationOpen ? ' max-md:hidden' : ''}`}
      >
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

      {tab === 'group' && (
        <div className="chat-layout grid grid-cols-1 md:grid-cols-[minmax(260px,320px)_1fr] gap-4 md:min-h-[480px] md:h-[calc(100dvh-12rem)] md:max-h-[840px]">
          <div className={`widget widget-violet widget-flush overflow-hidden flex flex-col min-h-[180px] md:min-h-0 ${selectedGroupId ? 'max-md:hidden' : ''}`}>
            <div className="shrink-0 px-4 py-3 border-b border-white/10">
              <p className="text-xs font-extrabold text-white/50 uppercase tracking-wider">Your Groups</p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
              {loadingGroups ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="h-14 widget animate-shimmer rounded-xl" />
                ))
              ) : groups.length === 0 ? (
                <p className="text-xs text-white/40 text-center py-6 px-2">
                  No groups yet. Create one from Groups page first.
                </p>
              ) : (
                groups.map((g) => {
                  const active = selectedGroupId === g.id;
                  const grad = avatarGradient(g.id);
                  const unread = unreadForGroup(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => openGroup(g.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                        active
                          ? 'bg-violet-500/20 border border-violet-500/30'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center shrink-0 relative`}>
                        <span className="text-[10px] font-extrabold text-white">
                          {groupInitials(g.name)}
                        </span>
                        {unread > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-cyan-500 text-white text-[9px] font-extrabold">
                            {unread > 9 ? '9+' : unread}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">{g.name}</p>
                        <p className="text-[10px] text-white/40">{g.memberCount} members</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className={`chat-conversation-column min-h-[320px] md:min-h-0 flex flex-col gap-3 ${!selectedGroupId ? 'max-md:hidden' : 'max-md:flex-1 max-md:min-h-0 max-md:gap-0'}`}>
            {!selectedGroupId || loadingGroupChat ? (
              <WidgetCard variant="violet" hover={false} className="flex-1 flex items-center justify-center text-center py-12">
                <MessageSquare size={40} className="text-violet-400/40 mx-auto mb-3" />
                <p className="text-white font-bold">
                  {loadingGroupChat ? 'Opening group chat…' : 'Select a group to chat'}
                </p>
                {!selectedGroupId && (
                  <p className="text-white/45 text-sm mt-2 max-w-xs mx-auto">
                    Pick any group from the list on the left to open its chat.
                  </p>
                )}
              </WidgetCard>
            ) : groupError && isSetupError(groupError) ? (
              setupHint
            ) : groupError ? (
              <WidgetCard variant="rose" hover={false} className="text-center py-8">
                <p className="text-rose-200 text-sm">{groupError}</p>
              </WidgetCard>
            ) : groupConversation && currentUserId ? (
              <div className="flex-1 min-h-0 chat-panel-mobile">
                <ChatPanel
                  conversation={{ ...groupConversation, title: selectedGroup?.name ?? groupConversation.title }}
                  currentUserId={currentUserId}
                  currentDisplayName={currentDisplayName}
                  onBack={() => {
                    setSelectedGroupId(null);
                    setGroupConversation(null);
                    setGroupError('');
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      )}

      {tab === 'dm' && (
        <div className="chat-layout grid grid-cols-1 md:grid-cols-[minmax(260px,320px)_1fr] gap-4 md:min-h-[480px] md:h-[calc(100dvh-12rem)] md:max-h-[840px]">
          <div className={`widget widget-fuchsia widget-flush overflow-hidden flex flex-col min-h-[180px] md:min-h-0 ${selectedContactId ? 'max-md:hidden' : ''}`}>
            <div className="shrink-0 px-4 py-3 border-b border-white/10">
              <p className="text-xs font-extrabold text-white/50 uppercase tracking-wider">Direct Messages</p>
              <p className="text-[10px] text-white/35 mt-1">Members from your shared groups</p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
              {loadingContacts ? (
                [1, 2].map((i) => (
                  <div key={i} className="h-14 widget animate-shimmer rounded-xl" />
                ))
              ) : contacts.length === 0 ? (
                <div className="text-xs text-white/40 text-center py-6 px-3 space-y-2">
                  <p>No contacts yet.</p>
                  <p className="text-white/30 leading-relaxed">
                    People from your shared groups will appear here. Tap someone to start a direct message.
                  </p>
                </div>
              ) : (
                contacts.map((c) => {
                  const active = selectedContactId === c.user_id;
                  const grad = avatarGradient(c.user_id);
                  const unread = unreadForUser(c.user_id);
                  const presence = getPresence(c.user_id);
                  const online = presence?.isOnline ?? false;
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
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center shrink-0 relative`}>
                        <span className="text-[10px] font-extrabold text-white">
                          {profileInitials(c.display_name)}
                        </span>
                        <span className="absolute -bottom-0.5 -right-0.5">
                          <PresenceDot online={online} size="sm" />
                        </span>
                        {unread > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-cyan-500 text-white text-[9px] font-extrabold">
                            {unread > 9 ? '9+' : unread}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">{c.display_name}</p>
                        <p className={`text-[10px] truncate ${online ? 'text-lime-400/90' : 'text-white/40'}`}>
                          {online ? 'Online' : presenceStatusLabel(presence)}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className={`chat-conversation-column min-h-[320px] md:min-h-0 flex flex-col gap-3 ${!selectedContactId ? 'max-md:hidden' : 'max-md:flex-1 max-md:min-h-0 max-md:gap-0'}`}>
            {!selectedContactId || loadingDm ? (
              <WidgetCard variant="violet" hover={false} className="flex-1 flex items-center justify-center text-center py-12">
                <MessageSquare size={40} className="text-violet-400/40 mx-auto mb-3" />
                <p className="text-white font-bold">
                  {loadingDm ? 'Opening chat…' : 'Select someone to message'}
                </p>
                {!selectedContactId && contacts.length > 0 && (
                  <p className="text-white/45 text-sm mt-2 max-w-xs mx-auto leading-relaxed">
                    1. Choose a person on the left<br />
                    2. Type your message below<br />
                    3. Press Enter to send — typing indicators appear live
                  </p>
                )}
              </WidgetCard>
            ) : dmConversation && currentUserId ? (
              <div className="flex-1 min-h-0 chat-panel-mobile">
                <ChatPanel
                  conversation={dmConversation}
                  currentUserId={currentUserId}
                  currentDisplayName={currentDisplayName}
                  onBack={() => {
                    setSelectedContactId(null);
                    setDmConversation(null);
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

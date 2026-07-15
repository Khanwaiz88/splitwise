'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { sendGroupInvite } from '@/utils/invitesApi';
import { addMemberByEmail, addGuestMemberByName } from '@/utils/membersApi';
import type { Member } from '@/utils/splitMath';
import { toast } from 'react-hot-toast';
import {
  UserPlus, Search, Loader2, X, Link2, Copy, UserCheck, CheckCircle2, UserRound,
} from 'lucide-react';

type Profile = { id: string; display_name?: string; email?: string };

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9 ]{1,29}$/;

export default function InviteMember({
  groupId,
  currentUserId,
  existingMemberIds,
  existingMemberNames = [],
  onMemberAdded,
}: {
  groupId: string;
  currentUserId: string;
  existingMemberIds: string[];
  existingMemberNames?: string[];
  onMemberAdded: (member: Member) => void;
}) {
  const supabase = createClient();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isAddingGuest, setIsAddingGuest] = useState(false);
  const [inviteLinkUrl, setInviteLinkUrl] = useState('');

  const trimmed = query.trim();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const nameValid = NAME_PATTERN.test(trimmed);
  const nameTaken = nameValid && existingMemberNames.some(
    (n) => n.trim().toLowerCase() === trimmed.toLowerCase(),
  );

  useEffect(() => {
    if (!trimmed || !emailValid) { setResults([]); return; }
    const t = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, display_name, email')
          .ilike('email', `%${trimmed.toLowerCase()}%`)
          .limit(6);
        setResults((data ?? []).filter((p: Profile) => p.id !== currentUserId));
      } finally {
        setIsSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [trimmed, emailValid, currentUserId, supabase]);

  const resetInvite = () => setInviteLinkUrl('');

  const addExistingUser = async (email: string) => {
    setIsAdding(true);
    resetInvite();
    try {
      const member = await addMemberByEmail(groupId, email.trim().toLowerCase());
      onMemberAdded({
        id: member.id,
        display_name: member.display_name,
        email: member.email,
        is_guest: member.is_guest,
      });
      toast.success(`${member.display_name} added to group!`);
      setQuery('');
      setResults([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setIsAdding(false);
    }
  };

  const addGuestByName = async () => {
    if (!nameValid) {
      toast.error('Enter a valid name (2–30 chars, start with a letter).');
      return;
    }
    if (nameTaken) {
      toast.error('A member with this name already exists.');
      return;
    }
    setIsAddingGuest(true);
    resetInvite();
    try {
      const member = await addGuestMemberByName(groupId, trimmed);
      onMemberAdded({
        id: member.id,
        display_name: member.display_name,
        email: '',
        is_guest: true,
      });
      toast.success(`"${member.display_name}" added as guest member!`);
      setQuery('');
      setResults([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add guest member');
    } finally {
      setIsAddingGuest(false);
    }
  };

  const createInvite = async () => {
    const email = trimmed.toLowerCase();
    if (!emailValid) { toast.error('Enter a valid email address.'); return; }
    setIsInviting(true);
    resetInvite();
    try {
      const result = await sendGroupInvite(groupId, email);
      setInviteLinkUrl(result.joinUrl);
      if (result.emailSent) {
        toast.success(result.hasAccount
          ? 'Invite sent! They will see it in the app and by email.'
          : 'Invite sent by email! Share the link too if needed.');
      } else if (result.emailSkipped) {
        toast.success('Invite saved — copy the link below (configure SMTP for email).');
      } else {
        toast.success('Invite created — copy the link below.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLinkUrl);
    toast.success('Link copied!');
  };

  const busy = isAdding || isInviting || isAddingGuest;

  return (
    <div>
      <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2.5">
        <span className="icon-badge bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-300">
          <UserPlus size={16} />
        </span>
        Add Members
      </h2>
      <div className="widget space-y-4">
        <div className="input-group">
          <span className="input-group-icon" aria-hidden>
            <Search size={18} strokeWidth={2} />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); resetInvite(); }}
            placeholder="Email or member name…"
            className="input-group-field"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setResults([]); resetInvite(); }}
              className="flex items-center justify-center w-11 shrink-0 text-white/35 hover:text-white border-l border-white/8"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {emailValid && (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => addExistingUser(query)}
              disabled={busy}
              className="flex flex-col items-center gap-1.5 py-4 px-2 rounded-xl bg-gradient-to-br from-lime-500/15 to-emerald-500/10 border border-lime-500/30 text-lime-300 hover:border-lime-400/50 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {isAdding ? <Loader2 size={20} className="animate-spin" /> : <UserCheck size={20} />}
              <span className="text-xs font-extrabold">Add to Group</span>
              <span className="text-[10px] text-lime-300/60 text-center leading-tight">Skip invite</span>
            </button>
            <button
              type="button"
              onClick={createInvite}
              disabled={busy}
              className="flex flex-col items-center gap-1.5 py-4 px-2 rounded-xl bg-gradient-to-br from-cyan-500/15 to-sky-500/10 border border-cyan-500/30 text-cyan-300 hover:border-cyan-400/50 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {isInviting ? <Loader2 size={20} className="animate-spin" /> : <Link2 size={20} />}
              <span className="text-xs font-extrabold">Send Invite</span>
              <span className="text-[10px] text-cyan-300/60 text-center leading-tight">Email + app</span>
            </button>
          </div>
        )}

        {!emailValid && nameValid && (
          <button
            type="button"
            onClick={addGuestByName}
            disabled={busy || nameTaken}
            className="w-full flex items-center justify-center gap-2.5 py-4 px-3 rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/30 text-amber-200 hover:border-amber-400/50 disabled:opacity-50 transition-all"
          >
            {isAddingGuest ? <Loader2 size={20} className="animate-spin" /> : <UserRound size={20} />}
            <span className="text-sm font-extrabold">
              {nameTaken ? 'Name already in group' : `Add "${trimmed}" by name`}
            </span>
          </button>
        )}

        {!emailValid && trimmed.length > 0 && !nameValid && (
          <p className="text-xs text-white/40 px-1">
            Enter a valid <strong className="text-white/60">email</strong> or a{' '}
            <strong className="text-white/60">name</strong> (e.g. Ali, John — no account needed).
          </p>
        )}

        {isSearching && (
          <div className="flex items-center gap-2 text-xs text-violet-300/60 px-1">
            <Loader2 size={12} className="animate-spin" /> Searching database…
          </div>
        )}

        {!isSearching && results.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-extrabold text-violet-300/50 uppercase tracking-widest px-1">
              Registered users
            </p>
            {results.map((p) => {
              const alreadyMember = existingMemberIds.includes(p.id);
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 glass-light border border-white/8 rounded-xl px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{p.display_name ?? p.email}</p>
                    <p className="text-xs text-white/40 truncate">{p.email}</p>
                  </div>
                  {alreadyMember ? (
                    <span className="text-xs text-lime-300 font-bold shrink-0 flex items-center gap-1">
                      <CheckCircle2 size={13} /> In group
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => p.email && addExistingUser(p.email)}
                      disabled={isAdding}
                      className="shrink-0 px-3 py-1.5 text-xs font-extrabold bg-lime-500/20 text-lime-300 hover:bg-lime-500/30 rounded-lg border border-lime-500/30 transition-all"
                    >
                      Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!isSearching && emailValid && results.length === 0 && (
          <p className="text-xs text-white/40 px-1">
            No user found — use <strong className="text-cyan-300">Send Invite</strong> for email + app notification.
          </p>
        )}

        {inviteLinkUrl && (
          <div className="glass-light border border-cyan-500/30 rounded-xl p-3 space-y-2 animate-scale-in">
            <p className="text-xs text-cyan-300 font-bold">Share this invite link:</p>
            <div className="flex gap-2">
              <input readOnly value={inviteLinkUrl} className="input-field text-xs truncate flex-1 py-2" />
              <button type="button" onClick={copyLink} className="shrink-0 px-3 py-2 btn-gradient rounded-xl text-xs font-bold flex items-center gap-1">
                <Copy size={12} /> Copy
              </button>
            </div>
            <p className="text-[10px] text-white/30">Valid 7 days · Also sent by email when SMTP is configured</p>
          </div>
        )}
      </div>
    </div>
  );
}

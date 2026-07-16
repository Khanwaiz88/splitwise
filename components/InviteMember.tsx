'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { sendGroupInvite } from '@/utils/invitesApi';
import { addGuestMemberByName } from '@/utils/membersApi';
import type { Member } from '@/utils/splitMath';
import { toast } from 'react-hot-toast';
import {
  UserPlus, Search, Loader2, X, Link2, Copy, CheckCircle2, UserRound, Mail, Database,
} from 'lucide-react';

type Profile = { id: string; display_name?: string; email?: string };
type InviteMode = 'gmail' | 'link' | 'guest' | 'supabase';

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9 ]{1,29}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MODES: { id: InviteMode; label: string; icon: typeof Mail; hint: string }[] = [
  { id: 'gmail', label: 'Gmail', icon: Mail, hint: 'Send invite email automatically' },
  { id: 'link', label: 'Link', icon: Link2, hint: 'Copy link — share on WhatsApp etc.' },
  { id: 'guest', label: 'Guest', icon: UserRound, hint: 'Add by name, no account' },
  { id: 'supabase', label: 'Database', icon: Database, hint: 'Find registered users' },
];

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
  const [mode, setMode] = useState<InviteMode>('gmail');
  const [emailInput, setEmailInput] = useState('');
  const [guestName, setGuestName] = useState('');
  const [dbQuery, setDbQuery] = useState('');
  const [dbResults, setDbResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isAddingGuest, setIsAddingGuest] = useState(false);
  const [inviteLinkUrl, setInviteLinkUrl] = useState('');

  const trimmedEmail = emailInput.trim();
  const emailValid = EMAIL_PATTERN.test(trimmedEmail);
  const trimmedGuest = guestName.trim();
  const guestValid = NAME_PATTERN.test(trimmedGuest);
  const guestTaken = guestValid && existingMemberNames.some(
    (n) => n.trim().toLowerCase() === trimmedGuest.toLowerCase(),
  );
  const dbTrimmed = dbQuery.trim();

  useEffect(() => {
    if (mode !== 'supabase' || dbTrimmed.length < 2) {
      setDbResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setIsSearching(true);
      try {
        const q = `%${dbTrimmed}%`;
        const { data } = await supabase
          .from('profiles')
          .select('id, display_name, email')
          .or(`display_name.ilike.${q},email.ilike.${q}`)
          .limit(8);
        setDbResults((data ?? []).filter((p: Profile) => p.id !== currentUserId));
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [mode, dbTrimmed, currentUserId, supabase]);

  const resetLink = () => setInviteLinkUrl('');

  const switchMode = (next: InviteMode) => {
    setMode(next);
    resetLink();
  };

  const showInviteResult = (result: Awaited<ReturnType<typeof sendGroupInvite>>, viaEmail: boolean) => {
    setInviteLinkUrl(result.joinUrl);
    if (viaEmail) {
      if (result.emailSent) {
        toast.success(result.hasAccount
          ? 'Email sent! They can Accept or Decline in Invites.'
          : 'Email sent! They sign up with that address, then Accept.');
      } else if (result.emailSkipped) {
        toast.error('Invite saved but email NOT sent — server email not configured.');
      } else {
        toast.error('Invite saved but email failed — share the link below.');
      }
    } else {
      toast.success('Invite link ready — copy and share it!');
    }
  };

  const createInvite = async (email: string, viaEmail: boolean) => {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      toast.error('Enter a valid email address.');
      return;
    }
    setIsInviting(true);
    resetLink();
    try {
      const result = await sendGroupInvite(groupId, normalized, { sendEmail: viaEmail });
      showInviteResult(result, viaEmail);
      if (viaEmail) setEmailInput('');
      setDbQuery('');
      setDbResults([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  };

  const addGuestByName = async () => {
    if (!guestValid) {
      toast.error('Enter a valid name (2–30 chars, start with a letter).');
      return;
    }
    if (guestTaken) {
      toast.error('A member with this name already exists.');
      return;
    }
    setIsAddingGuest(true);
    resetLink();
    try {
      const member = await addGuestMemberByName(groupId, trimmedGuest);
      onMemberAdded({
        id: member.id,
        display_name: member.display_name,
        email: '',
        is_guest: true,
      });
      toast.success(`"${member.display_name}" added as guest!`);
      setGuestName('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add guest');
    } finally {
      setIsAddingGuest(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLinkUrl);
    toast.success('Link copied!');
  };

  const busy = isInviting || isAddingGuest;

  return (
    <div>
      <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2.5">
        <span className="icon-badge bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-300">
          <UserPlus size={16} />
        </span>
        Add Members
      </h2>

      <div className="widget space-y-4">
        {/* Mode tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => switchMode(id)}
              className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-center transition-all ${
                mode === id
                  ? 'bg-violet-500/20 border-violet-400/50 text-violet-200 shadow-[0_0_20px_rgba(139,92,246,0.15)]'
                  : 'bg-white/3 border-white/8 text-white/45 hover:border-white/15 hover:text-white/70'
              }`}
            >
              <Icon size={18} strokeWidth={2.25} />
              <span className="text-[11px] font-extrabold leading-tight">{label}</span>
            </button>
          ))}
        </div>

        <p className="text-[11px] text-white/35 px-1 -mt-1">
          {MODES.find((m) => m.id === mode)?.hint}
        </p>

        {/* Gmail — send email invite */}
        {mode === 'gmail' && (
          <div className="space-y-3 animate-scale-in">
            <div className="input-group">
              <span className="input-group-icon" aria-hidden><Mail size={18} /></span>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => { setEmailInput(e.target.value); resetLink(); }}
                placeholder="friend@gmail.com"
                className="input-group-field"
              />
              {emailInput && (
                <button
                  type="button"
                  onClick={() => { setEmailInput(''); resetLink(); }}
                  className="flex items-center justify-center w-11 shrink-0 text-white/35 hover:text-white border-l border-white/8"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => createInvite(trimmedEmail, true)}
              disabled={busy || !emailValid}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl bg-gradient-to-br from-cyan-500/15 to-sky-500/10 border border-cyan-500/30 text-cyan-300 hover:border-cyan-400/50 disabled:opacity-40 transition-all"
            >
              {isInviting ? <Loader2 size={20} className="animate-spin" /> : <Mail size={20} />}
              <span className="text-sm font-extrabold">Send invite via Gmail / email</span>
            </button>
            <p className="text-xs text-white/40 px-1">
              Sends automatically via Resend or SMTP. They must <strong className="text-white/60">Accept</strong> before joining.
            </p>
          </div>
        )}

        {/* Link — generate copy link, no email */}
        {mode === 'link' && (
          <div className="space-y-3 animate-scale-in">
            <div className="input-group">
              <span className="input-group-icon" aria-hidden><Link2 size={18} /></span>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => { setEmailInput(e.target.value); resetLink(); }}
                placeholder="Invitee email (for signup match)"
                className="input-group-field"
              />
              {emailInput && (
                <button
                  type="button"
                  onClick={() => { setEmailInput(''); resetLink(); }}
                  className="flex items-center justify-center w-11 shrink-0 text-white/35 hover:text-white border-l border-white/8"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => createInvite(trimmedEmail, false)}
              disabled={busy || !emailValid}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl bg-gradient-to-br from-fuchsia-500/15 to-violet-500/10 border border-fuchsia-500/30 text-fuchsia-200 hover:border-fuchsia-400/50 disabled:opacity-40 transition-all"
            >
              {isInviting ? <Loader2 size={20} className="animate-spin" /> : <Link2 size={20} />}
              <span className="text-sm font-extrabold">Generate invite link</span>
            </button>
            <p className="text-xs text-white/40 px-1">
              No email sent — copy the link and share on WhatsApp, SMS, etc.
            </p>
          </div>
        )}

        {/* Guest — add by name */}
        {mode === 'guest' && (
          <div className="space-y-3 animate-scale-in">
            <div className="input-group">
              <span className="input-group-icon" aria-hidden><UserRound size={18} /></span>
              <input
                type="text"
                value={guestName}
                onChange={(e) => { setGuestName(e.target.value); resetLink(); }}
                placeholder="Name e.g. Ali, John"
                className="input-group-field"
              />
              {guestName && (
                <button
                  type="button"
                  onClick={() => setGuestName('')}
                  className="flex items-center justify-center w-11 shrink-0 text-white/35 hover:text-white border-l border-white/8"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={addGuestByName}
              disabled={busy || !guestValid || guestTaken}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/30 text-amber-200 hover:border-amber-400/50 disabled:opacity-40 transition-all"
            >
              {isAddingGuest ? <Loader2 size={20} className="animate-spin" /> : <UserRound size={20} />}
              <span className="text-sm font-extrabold">
                {guestTaken ? 'Name already in group' : `Add "${trimmedGuest || 'guest'}" to group`}
              </span>
            </button>
            <p className="text-xs text-white/40 px-1">
              Guest members have no login — you track their share of expenses by name.
            </p>
          </div>
        )}

        {/* Supabase — search registered users */}
        {mode === 'supabase' && (
          <div className="space-y-3 animate-scale-in">
            <div className="input-group">
              <span className="input-group-icon" aria-hidden><Search size={18} /></span>
              <input
                type="text"
                value={dbQuery}
                onChange={(e) => { setDbQuery(e.target.value); resetLink(); }}
                placeholder="Search name or email in database…"
                className="input-group-field"
              />
              {dbQuery && (
                <button
                  type="button"
                  onClick={() => { setDbQuery(''); setDbResults([]); resetLink(); }}
                  className="flex items-center justify-center w-11 shrink-0 text-white/35 hover:text-white border-l border-white/8"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {isSearching && (
              <div className="flex items-center gap-2 text-xs text-violet-300/60 px-1">
                <Loader2 size={12} className="animate-spin" /> Searching Supabase…
              </div>
            )}

            {!isSearching && dbTrimmed.length >= 2 && dbResults.length === 0 && (
              <p className="text-xs text-white/40 px-1">No registered users found.</p>
            )}

            {!isSearching && dbResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-extrabold text-violet-300/50 uppercase tracking-widest px-1">
                  Registered users
                </p>
                {dbResults.map((p) => {
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
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            onClick={() => p.email && createInvite(p.email, true)}
                            disabled={isInviting || !p.email}
                            title="Send email invite"
                            className="px-2.5 py-1.5 text-xs font-extrabold bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 rounded-lg border border-cyan-500/30 transition-all flex items-center gap-1"
                          >
                            <Mail size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => p.email && createInvite(p.email, false)}
                            disabled={isInviting || !p.email}
                            title="Get invite link"
                            className="px-2.5 py-1.5 text-xs font-extrabold bg-fuchsia-500/20 text-fuchsia-200 hover:bg-fuchsia-500/30 rounded-lg border border-fuchsia-500/30 transition-all flex items-center gap-1"
                          >
                            <Link2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {dbTrimmed.length < 2 && (
              <p className="text-xs text-white/40 px-1">
                Type at least 2 characters to search all users in Supabase.
              </p>
            )}
          </div>
        )}

        {/* Shared invite link result */}
        {inviteLinkUrl && (
          <div className="glass-light border border-cyan-500/30 rounded-xl p-3 space-y-2 animate-scale-in">
            <p className="text-xs text-cyan-300 font-bold">Invite link (valid 7 days):</p>
            <div className="flex gap-2">
              <input readOnly value={inviteLinkUrl} className="input-field text-xs truncate flex-1 py-2" />
              <button type="button" onClick={copyLink} className="shrink-0 px-3 py-2 btn-gradient rounded-xl text-xs font-bold flex items-center gap-1">
                <Copy size={12} /> Copy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { addGuestMemberByName, addMemberByEmail, fetchGroupJoinLink } from '@/utils/membersApi';
import type { Member } from '@/utils/splitMath';
import { toast } from 'react-hot-toast';
import { UserPlus, Loader2, X, Link2, Copy, UserRound, Mail } from 'lucide-react';

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9 ]{1,29}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function InviteMember({
  groupId,
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
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [loadingLink, setLoadingLink] = useState(true);

  const trimmed = input.trim();
  const isEmail = EMAIL_PATTERN.test(trimmed);
  const isName = !isEmail && NAME_PATTERN.test(trimmed);
  const nameTaken = isName && existingMemberNames.some(
    (n) => n.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  const canSubmit = isEmail || (isName && !nameTaken);

  useEffect(() => {
    let cancelled = false;
    setLoadingLink(true);
    void fetchGroupJoinLink(groupId)
      .then((data) => { if (!cancelled) setShareUrl(data.joinUrl); })
      .catch(() => { if (!cancelled) setShareUrl(''); })
      .finally(() => { if (!cancelled) setLoadingLink(false); });
    return () => { cancelled = true; };
  }, [groupId]);

  const copyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Group link copied!');
  };

  const handleAdd = async () => {
    if (!canSubmit) {
      if (nameTaken) {
        toast.error('A member with this name already exists in the group.');
      } else if (trimmed.includes('@')) {
        toast.error('Enter a valid full email address.');
      } else {
        toast.error('Enter a name (2–30 chars) or a full email address.');
      }
      return;
    }

    setBusy(true);
    try {
      if (isEmail) {
        const result = await addMemberByEmail(groupId, trimmed.toLowerCase());
        if (result.invited) {
          if (result.emailSent) {
            toast.success('Invite email sent! They can join after sign up.');
          } else if (result.emailSkipped) {
            toast.error('Invite saved but email was not sent — server email not configured.');
          } else {
            toast.error(result.emailError ?? 'Invite saved but email failed to send.');
          }
          setInput('');
          return;
        }

        if (existingMemberIds.includes(result.id)) {
          toast.error('This person is already in the group.');
          return;
        }

        onMemberAdded({
          id: result.id,
          display_name: result.display_name,
          email: result.email,
          is_guest: false,
        });
        if (result.emailSent) {
          toast.success(`${result.display_name} added — notification email sent!`);
        } else if (result.emailSkipped) {
          toast.success(`${result.display_name} added to the group (email not configured).`);
        } else {
          toast.success(`${result.display_name} added to the group.`);
          if (result.emailError) toast.error(`Email failed: ${result.emailError}`);
        }
      } else {
        const member = await addGuestMemberByName(groupId, trimmed);
        onMemberAdded({
          id: member.id,
          display_name: member.display_name,
          email: '',
          is_guest: true,
        });
        toast.success(`"${member.display_name}" added as guest!`);
      }
      setInput('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setBusy(false);
    }
  };

  let hint = 'Type a name for guest, or full email for registered user / invite';
  let inputIcon = UserRound;
  if (isEmail) {
    hint = 'Registered user is added instantly and gets an email · unknown email gets invite';
    inputIcon = Mail;
  } else if (isName) {
    hint = nameTaken ? 'This name is already in the group' : 'Will be added as guest (no login required)';
  } else if (trimmed.includes('@')) {
    hint = 'Enter a complete email like friend@gmail.com';
    inputIcon = Mail;
  }

  const InputIcon = inputIcon;

  return (
    <div>
      <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2.5">
        <span className="icon-badge bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-300">
          <UserPlus size={16} />
        </span>
        Add Members
      </h2>

      <div className="widget space-y-4">
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-white/45 uppercase tracking-wider px-1">
            Name or email
          </p>
          <div className="input-group">
            <span className="input-group-icon" aria-hidden><InputIcon size={18} /></span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ali · friend@gmail.com"
              className="input-group-field"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
            />
            {input && (
              <button
                type="button"
                onClick={() => setInput('')}
                className="flex items-center justify-center w-11 shrink-0 text-white/35 hover:text-white border-l border-white/8"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <p className={`text-xs px-1 ${nameTaken ? 'text-rose-300/80' : 'text-white/40'}`}>
            {hint}
          </p>
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy || !canSubmit}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border border-violet-500/30 text-violet-200 hover:border-violet-400/50 disabled:opacity-40 transition-all"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
            <span className="text-sm font-extrabold">Add member</span>
          </button>
        </div>

        <div className="border-t border-white/8 pt-4 space-y-2">
          <p className="text-[11px] font-bold text-white/45 uppercase tracking-wider px-1 flex items-center gap-1.5">
            <Link2 size={13} /> Group invite link
          </p>
          <p className="text-xs text-white/40 px-1">
            Fixed link for this group — share on WhatsApp. Anyone with an account can join instantly.
          </p>
          {loadingLink ? (
            <div className="flex items-center gap-2 text-xs text-violet-300/60 px-1 py-2">
              <Loader2 size={12} className="animate-spin" /> Loading link…
            </div>
          ) : shareUrl ? (
            <div className="flex gap-2">
              <input readOnly value={shareUrl} className="input-field text-xs truncate flex-1 py-2.5" />
              <button
                type="button"
                onClick={copyLink}
                className="shrink-0 px-3 py-2 btn-gradient rounded-xl text-xs font-bold flex items-center gap-1"
              >
                <Copy size={12} /> Copy
              </button>
            </div>
          ) : (
            <p className="text-xs text-amber-300/80 px-1">
              Link unavailable — run database migration: npm run db:apply
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

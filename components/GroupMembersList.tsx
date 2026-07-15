'use client';

import type { Member } from '@/utils/splitMath';
import { avatarGradient, avatarShadow } from '@/utils/avatarColor';
import { Users, UserMinus, Loader2 } from 'lucide-react';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type GroupMembersListProps = {
  members: Member[];
  currentUserId?: string;
  title?: string;
  compact?: boolean;
  embedded?: boolean;
  canManage?: boolean;
  removingId?: string | null;
  onRemove?: (member: Member) => void;
};

export default function GroupMembersList({
  members,
  currentUserId,
  title = 'Members',
  compact = false,
  embedded = false,
  canManage = false,
  removingId = null,
  onRemove,
}: GroupMembersListProps) {
  if (members.length === 0) {
    return (
      <div className={`text-center py-8 ${embedded ? 'rounded-xl border border-white/8 bg-white/[0.02]' : 'widget'}`}>
        <Users size={28} className="text-violet-400/30 mx-auto mb-2" />
        <p className="text-white/40 text-sm">No members yet</p>
      </div>
    );
  }

  const listClass = embedded
    ? 'space-y-2.5'
    : `widget ${compact ? 'widget-compact' : ''} space-y-2.5`;

  const showRemove = canManage && !!onRemove && members.length > 1;

  return (
    <div>
      {!compact && (
        <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2.5">
          <span className="icon-badge bg-cyan-500/20 border border-cyan-500/30 text-cyan-300">
            <Users size={16} />
          </span>
          {title}
          <span className="text-xs font-bold text-cyan-300 bg-cyan-500/15 px-2.5 py-0.5 rounded-full border border-cyan-500/25">
            {members.length}
          </span>
        </h2>
      )}
      <div className={listClass}>
        {members.map((member, idx) => {
          const isYou = member.id === currentUserId;
          const label = member.display_name || member.email || 'Unknown';
          const grad = avatarGradient(member.id);
          const shadow = avatarShadow(member.id);
          const isRemoving = removingId === member.id;
          const canRemoveThis = showRemove && !isRemoving;

          return (
            <div
              key={member.id}
              className="flex items-center gap-3 glass-light border border-white/10 rounded-xl px-4 py-3 animate-fade-in-up"
              style={{ animationDelay: `${idx * 60}ms`, opacity: 0 }}
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shrink-0 shadow-lg ${shadow}`}>
                <span className="text-xs font-extrabold text-white">{initials(label)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">
                  {isYou ? 'You' : label}
                </p>
                {member.email && (
                  <p className="text-xs text-white/40 truncate">{member.email}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {member.is_guest && (
                  <span className="text-[10px] font-extrabold text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-full border border-amber-500/30">
                    Guest
                  </span>
                )}
                {isYou ? (
                  <span className="text-[10px] font-extrabold text-violet-300 bg-violet-500/20 px-2.5 py-1 rounded-full border border-violet-500/30">
                    You
                  </span>
                ) : canRemoveThis ? (
                  <button
                    type="button"
                    onClick={() => onRemove?.(member)}
                    disabled={!!removingId}
                    className="p-2 rounded-lg text-rose-300/80 hover:text-rose-200 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/30 transition-colors disabled:opacity-50"
                    aria-label={`Remove ${label}`}
                    title="Remove member"
                  >
                    {isRemoving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <UserMinus size={16} />
                    )}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

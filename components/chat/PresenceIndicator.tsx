import { presenceStatusLabel, type PresenceEntry } from '@/utils/presenceApi';

export function PresenceDot({
  online,
  className = '',
  size = 'md',
}: {
  online: boolean;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  return (
    <span
      className={`${dim} rounded-full shrink-0 border-2 border-[var(--bg-elevated)] ${
        online ? 'bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.7)]' : 'bg-white/25'
      } ${className}`}
      aria-hidden
    />
  );
}

export function PresenceStatusText({
  entry,
  className = '',
}: {
  entry: PresenceEntry | undefined;
  className?: string;
}) {
  const online = entry?.isOnline ?? false;
  const label = presenceStatusLabel(entry);

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold truncate ${
        online ? 'text-lime-400' : 'text-white/40'
      } ${className}`}
    >
      {online && <PresenceDot online size="sm" className="border-transparent shadow-none" />}
      {label}
    </span>
  );
}

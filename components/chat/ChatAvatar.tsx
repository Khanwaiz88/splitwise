import { avatarGradient, avatarShadow } from '@/utils/avatarColor';

export function chatInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ChatAvatar({
  userId,
  name,
  size = 'md',
  className = '',
}: {
  userId: string;
  name: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const dim = size === 'sm' ? 'w-7 h-7 rounded-lg' : 'w-9 h-9 rounded-xl';
  const text = size === 'sm' ? 'text-[9px]' : 'text-[10px]';
  const grad = avatarGradient(userId);
  const shadow = avatarShadow(userId);

  return (
    <div
      className={`${dim} bg-gradient-to-br ${grad} flex items-center justify-center shrink-0 shadow-lg ${shadow} mt-1 ${className}`}
      title={name}
      aria-hidden
    >
      <span className={`${text} font-extrabold text-white leading-none`}>
        {chatInitials(name)}
      </span>
    </div>
  );
}

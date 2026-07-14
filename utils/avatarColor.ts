const GRADIENTS = [
  'from-violet-500 to-fuchsia-500',
  'from-cyan-400 to-blue-500',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-500',
  'from-lime-400 to-emerald-500',
  'from-sky-400 to-indigo-500',
  'from-fuchsia-400 to-violet-600',
  'from-teal-400 to-cyan-500',
];

export function avatarGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export function avatarShadow(id: string): string {
  const shadows = [
    'shadow-violet-500/30',
    'shadow-cyan-500/30',
    'shadow-amber-500/30',
    'shadow-rose-500/30',
    'shadow-lime-500/30',
    'shadow-sky-500/30',
    'shadow-fuchsia-500/30',
    'shadow-teal-500/30',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return shadows[Math.abs(hash) % shadows.length];
}

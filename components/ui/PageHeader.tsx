import { LucideIcon } from 'lucide-react';

export default function PageHeader({
  eyebrow,
  title,
  icon: Icon,
  action,
}: {
  eyebrow?: string;
  title: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-0 animate-fade-in-up">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="text-xs font-semibold text-violet-300/70 uppercase tracking-widest mb-1.5">
            {eyebrow}
          </p>
        )}
        <h1 className="text-xl sm:text-2xl md:text-[1.75rem] font-extrabold text-white flex items-center gap-3 tracking-tight">
          {Icon && (
            <span className="icon-badge bg-gradient-to-br from-violet-500/25 to-fuchsia-500/20 border border-violet-500/35 text-violet-200 shrink-0">
              <Icon size={20} />
            </span>
          )}
          <span className="truncate">{title}</span>
        </h1>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

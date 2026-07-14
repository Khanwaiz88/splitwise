type Variant = 'default' | 'violet' | 'fuchsia' | 'cyan' | 'amber' | 'rose' | 'lime';

const VARIANT_CLASS: Record<Variant, string> = {
  default: '',
  violet: 'widget-violet',
  fuchsia: 'widget-fuchsia',
  cyan: 'widget-cyan',
  amber: 'widget-amber',
  rose: 'widget-rose',
  lime: 'widget-lime',
};

export default function WidgetCard({
  children,
  className = '',
  variant = 'default',
  delay = 0,
  animate = true,
  hover = true,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: Variant;
  delay?: number;
  animate?: boolean;
  hover?: boolean;
}) {
  return (
    <div
      className={`widget ${VARIANT_CLASS[variant]} ${hover ? '' : 'hover:transform-none hover:shadow-none'} ${animate ? 'animate-fade-in-up' : ''} ${className}`}
      style={animate ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

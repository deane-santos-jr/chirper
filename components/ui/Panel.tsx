import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, subtitle, icon: Icon, actions, children, className = '' }: PanelProps) {
  return (
    <section className={`rounded-xl border border-slate-800 bg-slate-900 ${className}`}>
      <header className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <div>
            <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

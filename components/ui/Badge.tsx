import type { ReactNode } from 'react';

export type BadgeTone = 'inflow' | 'outflow' | 'warning' | 'info' | 'neutral';

const BADGE_TONE: Record<BadgeTone, string> = {
  inflow: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  outflow: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  neutral: 'border-slate-700 bg-slate-800 text-slate-300',
};

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${BADGE_TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}

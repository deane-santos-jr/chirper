import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function KpiCard({ label, icon: Icon, children }: { label: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="flex flex-col rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}

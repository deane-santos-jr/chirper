import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react';
import { Money } from '@/components/ui/Money';
import { daysBetween, formatShortDate, type IsoDate } from '@/lib/domain/calendar';
import type { LedgerEvent } from '@/lib/domain/ledger';
import { KpiCard } from './KpiCard';

function FlowRow({ event, start, direction }: { event: LedgerEvent | null; start: IsoDate; direction: 'in' | 'out' }) {
  const Icon = direction === 'in' ? ArrowDownLeft : ArrowUpRight;
  const tone = direction === 'in' ? 'text-emerald-400' : 'text-rose-400';
  if (!event) {
    return <p className="text-sm text-slate-500">No scheduled {direction === 'in' ? 'inflow' : 'outflow'} in range.</p>;
  }
  const days = daysBetween(start, event.date);
  return (
    <div className="flex items-start gap-2.5">
      <Icon className={`mt-1 h-4 w-4 shrink-0 ${tone}`} />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-slate-300">{formatShortDate(event.date)}:</span>
          <Money value={event.amount} tone={direction === 'in' ? 'inflow' : 'outflow'} signed className="text-lg font-semibold" />
        </div>
        <p className="truncate text-xs text-slate-400">{event.title}</p>
        <p className="text-[11px] text-slate-500">{days === 0 ? 'Today' : `in ${days} day(s)`}</p>
      </div>
    </div>
  );
}

export function FlowCard({ inflow, outflow, start }: { inflow: LedgerEvent | null; outflow: LedgerEvent | null; start: IsoDate }) {
  return (
    <KpiCard label="Next Inflow vs. Outflow" icon={ArrowLeftRight}>
      <div className="space-y-3">
        <FlowRow event={inflow} start={start} direction="in" />
        <div className="border-t border-slate-800" />
        <FlowRow event={outflow} start={start} direction="out" />
      </div>
    </KpiCard>
  );
}

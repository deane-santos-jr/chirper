'use client';

import { CheckCircle2, ChevronDown, ScrollText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { balanceTone, flowTone, Money } from '@/components/ui/Money';
import { formatMonthLabel, formatShortDate } from '@/lib/domain/calendar';
import { maxSafeLivingSpend, simulateLivingSpend } from '@/lib/domain/insights';
import type { CompletedItem, Ledger, LedgerMonth } from '@/lib/domain/ledger';
import { formatPeso } from '@/lib/domain/money';
import { LedgerRow } from './LedgerRow';
import { LivingSpendSimulator } from './LivingSpendSimulator';

function CompletedSummary({ items, title }: { items: CompletedItem[]; title: string }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> {title}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-emerald-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="space-y-1 border-t border-emerald-500/20 px-3 py-2 text-xs">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-slate-400">
                <span className="font-mono text-slate-500">{formatShortDate(item.date)}</span> {item.title}{' '}
                <span className="text-emerald-500/80">— {item.note}</span>
              </span>
              {item.amount !== 0 && <Money value={item.amount} tone={flowTone(item.amount)} signed />}
            </li>
          ))}
        </ul>
      )}
      <p className="px-3 pb-2 text-[10px] text-slate-500">Completed ✓ — already reflected in the starting balance, not counted again.</p>
    </div>
  );
}

function MonthSection({
  month,
  balances,
  simulated,
  collapsible,
}: {
  month: LedgerMonth;
  balances: Map<string, number>;
  simulated: boolean;
  collapsible: boolean;
}) {
  const [open, setOpen] = useState(!collapsible);
  const closing = month.events.at(-1);
  const closingBalance = closing ? balances.get(closing.id) : undefined;

  return (
    <section>
      <button
        type="button"
        disabled={!collapsible}
        onClick={() => setOpen(!open)}
        className="sticky top-0 z-10 flex w-full items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/95 py-2 text-left backdrop-blur"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {collapsible && <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />}
          {month.label}
          {collapsible && !open && <span className="font-normal normal-case tracking-normal text-slate-600">({month.events.length} events)</span>}
        </span>
        {closingBalance !== undefined && (
          <span className="text-[11px] text-slate-500">
            closes at <Money value={closingBalance} tone={balanceTone(closingBalance)} />
          </span>
        )}
      </button>
      {open && (
        <ol className="relative mt-3 space-y-2.5 before:absolute before:bottom-2 before:left-3 before:top-2 before:w-px before:bg-slate-800">
          {month.events.length === 0 && <li className="pl-9 text-xs text-slate-600">No scheduled events.</li>}
          {month.events.map((event) => (
            <LedgerRow key={event.id} event={event} balance={balances.get(event.id) ?? event.runningBalance} simulated={simulated} />
          ))}
        </ol>
      )}
    </section>
  );
}

export function RunwayLedger({ ledger, walletName, completedTitle }: { ledger: Ledger; walletName: string; completedTitle: string }) {
  const [livingSpend, setLivingSpend] = useState(0);
  const ceiling = useMemo(() => maxSafeLivingSpend(ledger), [ledger]);
  const simulation = useMemo(() => simulateLivingSpend(ledger, livingSpend), [ledger, livingSpend]);
  const balances = useMemo(() => new Map(simulation.map((row) => [row.event.id, row.simulatedBalance])), [simulation]);
  const lowest = simulation.reduce<{ date: string; balance: number }>(
    (min, row) => (row.simulatedBalance < min.balance ? { date: row.event.date, balance: row.simulatedBalance } : min),
    { date: ledger.startDate, balance: ledger.startingBalance },
  );

  return (
    <section className="flex max-h-full flex-col rounded-xl border border-slate-800 bg-slate-900">
      <header className="space-y-3 border-b border-slate-800 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-slate-100">Chronological Running Balance Ledger</h2>
          </div>
          <Badge tone="neutral">
            {formatShortDate(ledger.startDate)} → {formatShortDate(ledger.endDate)}
          </Badge>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-slate-950/60 px-3 py-2">
          <span className="text-xs text-slate-400">
            Today ({formatShortDate(ledger.startDate)}) • Starting {walletName} Balance:
          </span>
          <Money value={ledger.startingBalance} tone="safe" className="text-lg font-semibold" />
        </div>
        <LivingSpendSimulator value={livingSpend} onChange={setLivingSpend} ceiling={ceiling} />
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <Badge tone={lowest.balance < 0 ? 'outflow' : 'info'}>
            Lowest point: {formatShortDate(lowest.date)} {formatPeso(lowest.balance)}
          </Badge>
          {lowest.balance < 0 && <Badge tone="warning">Buffer needed: {formatPeso(-lowest.balance)}</Badge>}
        </div>
        <CompletedSummary items={ledger.completed} title={completedTitle} />
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        {ledger.months.map((month, index) => (
          <MonthSection
            key={month.key}
            month={month}
            balances={balances}
            simulated={livingSpend > 0}
            collapsible={index === ledger.months.length - 1}
          />
        ))}
        <p className="text-center text-[11px] text-slate-600">End of runway window • {formatMonthLabel(ledger.cycleMonth)} cycle</p>
      </div>
    </section>
  );
}

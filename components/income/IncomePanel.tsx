import { Banknote } from 'lucide-react';
import { toggleIncomeReceived } from '@/app/actions';
import { Badge } from '@/components/ui/Badge';
import { Money } from '@/components/ui/Money';
import { Panel } from '@/components/ui/Panel';
import { SettleToggle } from '@/components/ui/SettleToggle';
import { formatMonthShort, ordinal, type YearMonth, addMonths } from '@/lib/domain/calendar';
import { formatPeso } from '@/lib/domain/money';
import { absenceDeduction, netPay, STATUTORY_DEDUCTIONS, statutoryBreakdownMatches } from '@/lib/domain/payroll';
import type { IncomeRule } from '@/lib/domain/types';
import { AbsenceStepper } from './AbsenceStepper';

function PayrollBreakdown({ rule, absences }: { rule: IncomeRule; absences: number }) {
  const lines = statutoryBreakdownMatches(rule)
    ? ` (${STATUTORY_DEDUCTIONS.map((line) => `${line.label} ₱${line.amount.toLocaleString('en-PH')}`).join(', ')})`
    : '';
  const absenceCut = absenceDeduction(rule, absences);
  return (
    <p className="rounded-md border border-slate-800 bg-slate-950/60 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed tabular-nums text-slate-400">
      Base: <span className="text-slate-200">{formatPeso(rule.grossAmount)}</span> | Gov/HMO:{' '}
      <span className="text-rose-400">-{formatPeso(rule.fixedDeductions)}</span>
      {lines}
      {absenceCut > 0 && (
        <>
          {' '}| Absences: <span className="text-amber-400">-{formatPeso(absenceCut)}</span>
        </>
      )}{' '}
      | Net: <span className="text-emerald-400">{formatPeso(netPay(rule, absences))}</span>
    </p>
  );
}

function IncomeRow({ rule, cycle }: { rule: IncomeRule; cycle: YearMonth }) {
  const currentNet = netPay(rule, rule.currentAbsences);
  return (
    <li className="space-y-2.5 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{ordinal(rule.dayOfMonth)}</Badge>
            <span className="text-sm font-medium text-slate-100">{rule.name}</span>
          </div>
          <Money value={currentNet} tone="inflow" signed className="mt-1 block text-lg font-semibold" />
        </div>
        <SettleToggle
          settled={rule.receivedThisMonth}
          settledLabel="Received ✓"
          pendingLabel="Pending"
          amount={currentNet}
          direction="in"
          onToggle={toggleIncomeReceived.bind(null, rule.id)}
        />
      </div>
      {rule.isPayroll && (
        <>
          <PayrollBreakdown rule={rule} absences={rule.currentAbsences} />
          <div className="space-y-1.5">
            <AbsenceStepper
              incomeId={rule.id}
              period="current"
              monthLabel={formatMonthShort(cycle)}
              absences={rule.currentAbsences}
              absenceRate={rule.absenceRate}
            />
            <AbsenceStepper
              incomeId={rule.id}
              period="next"
              monthLabel={formatMonthShort(addMonths(cycle, 1))}
              absences={rule.nextMonthAbsences}
              absenceRate={rule.absenceRate}
            />
          </div>
        </>
      )}
    </li>
  );
}

export function IncomePanel({ incomes, cycle }: { incomes: IncomeRule[]; cycle: YearMonth }) {
  return (
    <Panel title="Payroll & Income Configurator" subtitle="Absences deduct only when entered for that cutoff (half-day steps)." icon={Banknote}>
      <ul className="divide-y divide-slate-800">
        {incomes.map((rule) => (
          <IncomeRow key={rule.id} rule={rule} cycle={cycle} />
        ))}
      </ul>
    </Panel>
  );
}

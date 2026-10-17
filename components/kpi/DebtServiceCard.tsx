import { Landmark, PartyPopper } from 'lucide-react';
import { Money } from '@/components/ui/Money';
import { formatLongDate, formatMonthLabel, formatMonthShort } from '@/lib/domain/calendar';
import type { LiberationMilestone, MonthlyDebtService } from '@/lib/domain/insights';
import { formatPeso } from '@/lib/domain/money';
import { KpiCard } from './KpiCard';

function loanNames(milestone: LiberationMilestone): string {
  const names = milestone.loans.map((loan) => loan.name);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names.at(-1)}` : names[0];
}

function serviceLabel(months: MonthlyDebtService[]): Array<{ label: string; total: number }> {
  const allEqual = months.every((month) => month.total === months[0]?.total);
  if (allEqual && months.length > 0) return [{ label: `/mo in ${months.map((m) => formatMonthShort(m.month)).join(' & ')}`, total: months[0].total }];
  return months.map((month) => ({ label: `in ${formatMonthShort(month.month)}`, total: month.total }));
}

export function DebtServiceCard({ service, milestones }: { service: MonthlyDebtService[]; milestones: LiberationMilestone[] }) {
  const [first, ...later] = milestones;
  return (
    <KpiCard label="Monthly Debt Service & Liberation" icon={Landmark}>
      <div className="space-y-0.5">
        {serviceLabel(service).map((row) => (
          <div key={row.label} className="flex items-baseline gap-1.5">
            <Money value={row.total} tone="outflow" className="text-2xl font-semibold" />
            <span className="text-xs text-slate-500">{row.label}</span>
          </div>
        ))}
      </div>
      {first ? (
        <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-xs leading-relaxed text-emerald-200">
          <PartyPopper className="mr-1 inline h-3.5 w-3.5 text-emerald-400" />
          In {first.installmentsLeft} installment(s) ({formatLongDate(first.finalPaymentDate)}), your {loanNames(first)}{' '}
          {first.loans.length > 1 ? 'finish' : 'finishes'}—unlocking{' '}
          <span className="font-mono font-semibold tabular-nums text-emerald-400">+{formatPeso(first.freedMonthly)}/mo</span> in pure free
          cash flow starting {formatMonthLabel(first.freedFromMonth)}!
        </div>
      ) : (
        <p className="mt-3 text-xs text-emerald-400">Debt-free. Every peso is yours.</p>
      )}
      {later.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[11px] text-slate-400">
          {later.map((milestone) => (
            <li key={milestone.finalPaymentDate}>
              Then {loanNames(milestone)} ends {formatLongDate(milestone.finalPaymentDate)} →{' '}
              <span className="font-mono tabular-nums text-emerald-400">+{formatPeso(milestone.freedMonthly)}/mo</span> from{' '}
              {formatMonthLabel(milestone.freedFromMonth)}
            </li>
          ))}
        </ul>
      )}
    </KpiCard>
  );
}

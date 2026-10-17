import { HandCoins } from 'lucide-react';
import { Money } from '@/components/ui/Money';
import { Panel } from '@/components/ui/Panel';
import { formatMonthShort, type YearMonth } from '@/lib/domain/calendar';
import { remainingBalance, scheduledInstallments } from '@/lib/domain/loans';
import { roundPesos } from '@/lib/domain/money';
import type { DebtSchedule } from '@/lib/domain/types';
import { AddLoan } from './AddLoan';
import { LoanCard } from './LoanCard';

const LOOKAHEAD_MONTHS = 600;

export function LoanPanel({ debts, cycle }: { debts: DebtSchedule[]; cycle: YearMonth }) {
  const totalRemaining = roundPesos(debts.reduce((sum, debt) => sum + remainingBalance(debt), 0));
  const cleared = debts.filter((debt) => debt.paidThisMonth).length;

  return (
    <Panel
      title="Loan Amortization & Installment Tracker"
      subtitle={`${cleared}/${debts.length} loans cleared for ${formatMonthShort(cycle)}`}
      icon={HandCoins}
      actions={
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Total remaining</p>
          <Money value={totalRemaining} tone="warning" className="text-sm font-semibold" />
        </div>
      }
    >
      <ul className="space-y-3">
        {debts.map((debt) => (
          <LoanCard
            key={debt.id}
            debt={debt}
            cycleMonthShort={formatMonthShort(cycle)}
            remainingBalance={remainingBalance(debt)}
            nextInstallment={scheduledInstallments(debt, cycle, LOOKAHEAD_MONTHS)[0] ?? null}
          />
        ))}
      </ul>
      <div className="mt-3">
        <AddLoan />
      </div>
    </Panel>
  );
}

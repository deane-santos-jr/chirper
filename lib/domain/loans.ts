import { addMonths, dateOf, type IsoDate, type YearMonth } from './calendar';
import { roundPesos } from './money';
import type { DebtSchedule } from './types';

export function remainingInstallments(debt: DebtSchedule): number {
  return Math.max(0, debt.totalInstallments - debt.paidInstallments);
}

export function remainingBalance(debt: DebtSchedule): number {
  return roundPesos(remainingInstallments(debt) * debt.monthlyAmount);
}

export function isFullyPaid(debt: DebtSchedule): boolean {
  return remainingInstallments(debt) === 0;
}

/**
 * Month offset (relative to the cycle month) of the next unpaid installment.
 * `paid_this_month` means nothing more is owed in the cycle month.
 */
function firstInstallmentOffset(debt: DebtSchedule): number {
  return debt.paidThisMonth ? 1 : 0;
}

export interface ScheduledInstallment {
  monthOffset: number;
  installmentNumber: number;
  date: IsoDate;
}

export function scheduledInstallments(debt: DebtSchedule, cycle: YearMonth, monthsAhead: number): ScheduledInstallment[] {
  const firstOffset = firstInstallmentOffset(debt);
  const installments: ScheduledInstallment[] = [];
  for (let k = 0; k < remainingInstallments(debt); k++) {
    const monthOffset = firstOffset + k;
    if (monthOffset > monthsAhead) break;
    installments.push({
      monthOffset,
      installmentNumber: debt.paidInstallments + 1 + k,
      date: dateOf(addMonths(cycle, monthOffset), debt.dueDay),
    });
  }
  return installments;
}

export interface LoanPayoff {
  debt: DebtSchedule;
  installmentsLeft: number;
  finalPaymentDate: IsoDate;
  freedFromMonth: YearMonth;
}

export function payoffOf(debt: DebtSchedule, cycle: YearMonth): LoanPayoff | null {
  const installmentsLeft = remainingInstallments(debt);
  if (installmentsLeft === 0) return null;
  const finalOffset = firstInstallmentOffset(debt) + installmentsLeft - 1;
  return {
    debt,
    installmentsLeft,
    finalPaymentDate: dateOf(addMonths(cycle, finalOffset), debt.dueDay),
    freedFromMonth: addMonths(cycle, finalOffset + 1),
  };
}

export function payoffsByDate(debts: DebtSchedule[], cycle: YearMonth): LoanPayoff[] {
  return debts
    .map((debt) => payoffOf(debt, cycle))
    .filter((payoff): payoff is LoanPayoff => payoff !== null)
    .sort((a, b) => a.finalPaymentDate.localeCompare(b.finalPaymentDate));
}

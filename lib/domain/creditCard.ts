import { addMonths, dateOf, nextOccurrenceAfter, yearMonthOf, type IsoDate } from './calendar';
import type { CreditCard } from './types';

export interface CardBill {
  statementDate: IsoDate;
  dueDate: IsoDate;
  amount: number;
  /** True for the bill tracked by `statement_balance`; later bills are projections. */
  isCurrentStatement: boolean;
}

/** The payment due date that settles the statement cut on `statementDate`. */
export function dueDateFor(card: CreditCard, statementDate: IsoDate): IsoDate {
  return nextOccurrenceAfter(statementDate, card.dueDay);
}

/**
 * Statement cuts paired with their due dates, ordered by due date, starting
 * with the first bill whose due date is on/after `from` and was not already settled.
 */
function billSchedule(card: CreditCard, from: IsoDate, until: IsoDate): Array<{ statementDate: IsoDate; dueDate: IsoDate }> {
  const schedule: Array<{ statementDate: IsoDate; dueDate: IsoDate }> = [];
  let month = addMonths(yearMonthOf(from), -2);
  for (;;) {
    const statementDate = dateOf(month, card.statementDay);
    if (statementDate > until) break;
    const dueDate = dueDateFor(card, statementDate);
    const settled = card.lastSettledDue !== null && dueDate <= card.lastSettledDue;
    if (dueDate >= from && !settled) schedule.push({ statementDate, dueDate });
    month = addMonths(month, 1);
  }
  return schedule;
}

/**
 * Current statement: `statement_balance` once cut; before the cut the bill is
 * at least the projected spend. Every later statement uses the projection.
 */
export function upcomingBills(card: CreditCard, from: IsoDate, until: IsoDate): CardBill[] {
  return billSchedule(card, from, until).map(({ statementDate, dueDate }, index) => {
    const isCurrentStatement = index === 0;
    const statementCut = statementDate <= from;
    const amount = !isCurrentStatement
      ? card.projectedMonthlySpend
      : statementCut
        ? card.statementBalance
        : Math.max(card.statementBalance, card.projectedMonthlySpend);
    return { statementDate, dueDate, amount, isCurrentStatement };
  });
}

export function currentBill(card: CreditCard, from: IsoDate): CardBill | null {
  const horizon = dateOf(addMonths(yearMonthOf(from), 2), 31);
  return upcomingBills(card, from, horizon)[0] ?? null;
}

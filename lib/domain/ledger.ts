import {
  addMonths,
  dateOf,
  firstDayOf,
  formatMonthLabel,
  formatShortDate,
  ordinal,
  lastDayOf,
  maxDate,
  yearMonthKey,
  yearMonthOf,
  type IsoDate,
  type YearMonth,
} from './calendar';
import { upcomingBills } from './creditCard';
import { remainingInstallments, scheduledInstallments } from './loans';
import { formatPeso, toCentavos, toPesos } from './money';
import { absenceDeduction, netPay } from './payroll';
import type { CreditCard, DebtSchedule, FinanceSnapshot, IncomeRule } from './types';

/** Current cycle month + the next two (the second one is the expandable view). */
export const MONTHS_AHEAD = 2;

export type LedgerEventKind = 'income' | 'debt' | 'card-due' | 'card-statement';

export interface LedgerEvent {
  id: string;
  date: IsoDate;
  /** Original schedule date when the item is past due and rolled onto `date`. */
  scheduledDate: IsoDate;
  kind: LedgerEventKind;
  title: string;
  detail: string;
  /** Signed cash movement in pesos: + inflow, - outflow, 0 informational. */
  amount: number;
  runningBalance: number;
  overdue: boolean;
  isPayroll: boolean;
}

export interface LedgerMonth {
  key: string;
  label: string;
  events: LedgerEvent[];
}

export interface CompletedItem {
  id: string;
  date: IsoDate;
  title: string;
  amount: number;
  note: string;
}

export interface Ledger {
  startDate: IsoDate;
  endDate: IsoDate;
  cycleMonth: YearMonth;
  startingBalance: number;
  months: LedgerMonth[];
  completed: CompletedItem[];
  lowestPoint: { date: IsoDate; balance: number };
  bufferNeeded: number;
}

type DraftEvent = Omit<LedgerEvent, 'runningBalance' | 'date' | 'overdue'>;

/** Same-day ordering: money lands, then info, then money leaves. */
const KIND_ORDER: Record<LedgerEventKind, number> = { income: 0, 'card-statement': 1, debt: 2, 'card-due': 2 };

function incomeAbsencesFor(rule: IncomeRule, monthOffset: number): number {
  if (monthOffset === 0) return rule.currentAbsences;
  if (monthOffset === 1) return rule.nextMonthAbsences;
  return 0;
}

function incomeDetail(rule: IncomeRule, absences: number): string {
  if (!rule.isPayroll) return 'Fixed side income';
  const deduction = absenceDeduction(rule, absences);
  return deduction > 0 ? `Net after ${absences} absence day(s)` : 'Net pay • 0 absences';
}

function incomeDrafts(rule: IncomeRule, cycle: YearMonth, completed: CompletedItem[]): DraftEvent[] {
  const drafts: DraftEvent[] = [];
  for (let offset = 0; offset <= MONTHS_AHEAD; offset++) {
    const scheduledDate = dateOf(addMonths(cycle, offset), rule.dayOfMonth);
    const absences = incomeAbsencesFor(rule, offset);
    const amount = netPay(rule, absences);
    const id = `income-${rule.id}-${offset}`;
    if (offset === 0 && rule.receivedThisMonth) {
      completed.push({ id, date: scheduledDate, title: rule.name, amount, note: 'Received ✓' });
      continue;
    }
    drafts.push({ id, scheduledDate, kind: 'income', title: rule.name, detail: incomeDetail(rule, absences), amount, isPayroll: rule.isPayroll });
  }
  return drafts;
}

function debtDrafts(debt: DebtSchedule, cycle: YearMonth, completed: CompletedItem[]): DraftEvent[] {
  if (debt.paidThisMonth) {
    const nothingPaidYet = debt.paidInstallments === 0;
    completed.push({
      id: `debt-${debt.id}-done`,
      date: dateOf(cycle, debt.dueDay),
      title: debt.name,
      amount: nothingPaidYet ? 0 : -debt.monthlyAmount,
      note: nothingPaidYet ? 'No installment due this month' : `${debt.paidInstallments}/${debt.totalInstallments} Paid ✓`,
    });
  }
  return scheduledInstallments(debt, cycle, MONTHS_AHEAD).map((installment) => ({
    id: `debt-${debt.id}-${installment.monthOffset}`,
    scheduledDate: installment.date,
    kind: 'debt' as const,
    title: `${debt.name} (${installment.installmentNumber}/${debt.totalInstallments})`,
    detail: installment.installmentNumber === debt.totalInstallments ? `${debt.lender} • FINAL installment` : debt.lender,
    amount: -debt.monthlyAmount,
    isPayroll: false,
  }));
}

function cardDrafts(card: CreditCard, start: IsoDate, end: IsoDate, completed: CompletedItem[]): DraftEvent[] {
  if (card.paidThisMonth && card.lastSettledDue) {
    completed.push({
      id: `card-${card.id}-done`,
      date: card.lastSettledDue,
      title: `${card.name} Statement`,
      amount: -card.lastPaidAmount,
      note: 'Settled ✓',
    });
  }
  const drafts: DraftEvent[] = [];
  for (const bill of upcomingBills(card, start, end)) {
    const projected = bill.isCurrentStatement ? '' : ' (projected)';
    if (bill.statementDate >= start) {
      drafts.push({
        id: `card-${card.id}-stmt-${bill.statementDate}`,
        scheduledDate: bill.statementDate,
        kind: 'card-statement',
        title: `${card.name} Statement Cuts — Due on the ${ordinal(card.dueDay)}`,
        detail: `${formatPeso(bill.amount)} billed${projected} — Payable ${formatShortDate(bill.dueDate)} • ₱0.00 cash outflow`,
        amount: 0,
        isPayroll: false,
      });
    }
    if (bill.dueDate <= end) {
      drafts.push({
        id: `card-${card.id}-due-${bill.dueDate}`,
        scheduledDate: bill.dueDate,
        kind: 'card-due',
        title: `${card.name} Payment (Deadline)`,
        detail: `Statement of ${formatShortDate(bill.statementDate)}${projected}`,
        amount: -bill.amount,
        isPayroll: false,
      });
    }
  }
  return drafts;
}

function compareEvents(a: LedgerEvent, b: LedgerEvent): number {
  return a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.scheduledDate.localeCompare(b.scheduledDate);
}

function groupByMonth(events: LedgerEvent[], cycle: YearMonth): LedgerMonth[] {
  return Array.from({ length: MONTHS_AHEAD + 1 }, (_, offset) => {
    const ym = addMonths(cycle, offset);
    const key = yearMonthKey(ym);
    return {
      key,
      label: formatMonthLabel(ym),
      events: events.filter((event) => yearMonthKey(yearMonthOf(event.date)) === key),
    };
  });
}

/**
 * Builds the forward-looking running balance. Items already received/paid in
 * the cycle month are reported as completed and never touch `starting_cash`.
 * Unpaid items whose date already passed are rolled onto today as overdue.
 */
export function buildLedger(snapshot: FinanceSnapshot, today: IsoDate): Ledger {
  const cycle = snapshot.settings.cycleMonth;
  const startDate = maxDate(today, firstDayOf(cycle));
  const endDate = lastDayOf(addMonths(cycle, MONTHS_AHEAD));
  const completed: CompletedItem[] = [];

  const drafts: DraftEvent[] = [
    ...snapshot.incomes.flatMap((rule) => incomeDrafts(rule, cycle, completed)),
    ...snapshot.debts.flatMap((debt) => debtDrafts(debt, cycle, completed)),
    ...snapshot.cards.flatMap((card) => cardDrafts(card, startDate, endDate, completed)),
  ];

  const ordered = drafts
    .map((draft) => ({ ...draft, date: maxDate(draft.scheduledDate, startDate), overdue: draft.scheduledDate < startDate, runningBalance: 0 }))
    .sort(compareEvents);

  let balance = toCentavos(snapshot.settings.walletBalance);
  let lowest = { date: startDate, balance };
  const events = ordered.map((event) => {
    balance += toCentavos(event.amount);
    if (balance < lowest.balance) lowest = { date: event.date, balance };
    return { ...event, runningBalance: toPesos(balance) };
  });

  completed.sort((a, b) => a.date.localeCompare(b.date));

  return {
    startDate,
    endDate,
    cycleMonth: cycle,
    startingBalance: snapshot.settings.walletBalance,
    months: groupByMonth(events, cycle),
    completed,
    lowestPoint: { date: lowest.date, balance: toPesos(lowest.balance) },
    bufferNeeded: lowest.balance < 0 ? toPesos(-lowest.balance) : 0,
  };
}

export function allEvents(ledger: Ledger): LedgerEvent[] {
  return ledger.months.flatMap((month) => month.events);
}

export function activeLoanCount(debts: DebtSchedule[]): number {
  return debts.filter((debt) => debt.paidThisMonth || remainingInstallments(debt) > 0).length;
}

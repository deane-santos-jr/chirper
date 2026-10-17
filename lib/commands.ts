import 'server-only';
import { firstDayOf, maxDate, todayLocal, type IsoDate } from './domain/calendar';
import { currentBill } from './domain/creditCard';
import { formatPeso, roundPesos } from './domain/money';
import { netPay, normalizeAbsences } from './domain/payroll';
import * as db from './db';

/**
 * Application use cases. Both the dashboard's Server Actions and the agent's
 * tools go through here, so every mutation follows the same rules. Each
 * command validates its input and returns a one-line summary of what changed.
 */

export class CommandError extends Error {}

/* ─────────────────────────────── guards ─────────────────────────────── */

function pesos(value: number, label: string, { allowZero = true } = {}): number {
  if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) {
    throw new CommandError(`${label} must be a ${allowZero ? 'non-negative' : 'positive'} peso amount.`);
  }
  return roundPesos(value);
}

function wholeNumber(value: number, label: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new CommandError(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

function nonEmpty(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new CommandError(`${label} is required.`);
  return trimmed;
}

function found<T>(value: T | null, label: string): T {
  if (value === null) throw new CommandError(`${label} not found.`);
  return value;
}

/** Drops undefined fields so a partial update never blanks out existing values. */
function defined<T extends object>(changes: T): Partial<T> {
  return Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function ledgerStart(): IsoDate {
  return maxDate(todayLocal(), firstDayOf(db.getSnapshot().settings.cycleMonth));
}

const walletNote = (delta: number) => (delta === 0 ? 'wallet unchanged' : `wallet ${delta > 0 ? '+' : '-'}${formatPeso(Math.abs(delta))}`);

/* ─────────────────────────────── wallet ────────────────────────────── */

export function setWalletBalance(balance: number): string {
  if (!Number.isFinite(balance)) throw new CommandError('Balance must be a number.');
  db.setWalletBalance(roundPesos(balance));
  return `Wallet balance set to ${formatPeso(balance)}`;
}

/* ─────────────────────────────── income ────────────────────────────── */

export function setAbsences(incomeId: number, period: 'current' | 'next', days: number): string {
  const rule = found(db.getIncomeRule(incomeId), 'Income');
  if (!rule.isPayroll) throw new CommandError(`${rule.name} is not a payroll income; absences do not apply.`);
  const absences = normalizeAbsences(days);
  db.setAbsences(incomeId, period, absences);
  return `${rule.name}: ${absences} absence day(s) for the ${period === 'current' ? 'current' : 'next'} month`;
}

export function stepAbsences(incomeId: number, period: 'current' | 'next', delta: number): string {
  const rule = found(db.getIncomeRule(incomeId), 'Income');
  const current = period === 'current' ? rule.currentAbsences : rule.nextMonthAbsences;
  return setAbsences(incomeId, period, current + delta);
}

export function setIncomeReceived(incomeId: number, received: boolean, syncWallet: boolean): string {
  const rule = found(db.getIncomeRule(incomeId), 'Income');
  if (rule.receivedThisMonth === received) return `${rule.name} already ${received ? 'received' : 'pending'}`;
  const amount = netPay(rule, rule.currentAbsences);
  const delta = syncWallet ? (received ? amount : -amount) : 0;
  db.setIncomeReceived(incomeId, received, delta);
  return `${rule.name} marked ${received ? 'received' : 'pending'} (${walletNote(delta)})`;
}

export function toggleIncomeReceived(incomeId: number, syncWallet: boolean): string {
  const rule = found(db.getIncomeRule(incomeId), 'Income');
  return setIncomeReceived(incomeId, !rule.receivedThisMonth, syncWallet);
}

export interface IncomeFields {
  name: string;
  dayOfMonth: number;
  grossAmount: number;
  fixedDeductions: number;
  isPayroll: boolean;
  absenceRate: number;
}

function validIncome(input: IncomeFields): db.IncomeInput {
  return {
    name: nonEmpty(input.name, 'Income name'),
    dayOfMonth: wholeNumber(input.dayOfMonth, 'Day of month', 1, 31),
    grossAmount: pesos(input.grossAmount, 'Gross amount', { allowZero: false }),
    fixedDeductions: pesos(input.fixedDeductions, 'Fixed deductions'),
    isPayroll: input.isPayroll,
    absenceRate: pesos(input.absenceRate, 'Absence rate'),
  };
}

export function addIncome(input: IncomeFields): string {
  const id = db.insertIncome(validIncome(input));
  return `Added income #${id} ${input.name} (${formatPeso(input.grossAmount)} on day ${input.dayOfMonth})`;
}

export function updateIncome(incomeId: number, changes: Partial<IncomeFields>): string {
  const rule = found(db.getIncomeRule(incomeId), 'Income');
  db.updateIncome(incomeId, validIncome({ ...rule, ...defined(changes) }));
  return `Updated income ${rule.name}`;
}

/* ─────────────────────────────── loans ─────────────────────────────── */

/**
 * The wallet moves only by an installment that actually changed: a finished
 * loan, or one with nothing paid yet flagged "not due this month", moves no cash.
 */
export function setLoanPaid(debtId: number, paid: boolean, syncWallet: boolean): string {
  const debt = found(db.getDebtSchedule(debtId), 'Loan');
  if (debt.paidThisMonth === paid) return `${debt.name} already ${paid ? 'paid' : 'unpaid'} this month`;
  const installments = paid ? Math.min(debt.totalInstallments, debt.paidInstallments + 1) : Math.max(0, debt.paidInstallments - 1);
  const delta = syncWallet ? roundPesos((debt.paidInstallments - installments) * debt.monthlyAmount) : 0;
  db.setDebtPaid(debtId, paid, installments, delta);
  return `${debt.name} marked ${paid ? 'paid' : 'unpaid'} — ${installments}/${debt.totalInstallments} (${walletNote(delta)})`;
}

export function toggleLoanPaid(debtId: number, syncWallet: boolean): string {
  const debt = found(db.getDebtSchedule(debtId), 'Loan');
  return setLoanPaid(debtId, !debt.paidThisMonth, syncWallet);
}

function validLoan(input: db.DebtInput): db.DebtInput {
  const totalInstallments = wholeNumber(input.totalInstallments, 'Total installments', 1, 600);
  return {
    name: nonEmpty(input.name, 'Loan name'),
    lender: input.lender.trim(),
    dueDay: wholeNumber(input.dueDay, 'Due day', 1, 31),
    monthlyAmount: pesos(input.monthlyAmount, 'Monthly amount', { allowZero: false }),
    totalInstallments,
    paidInstallments: wholeNumber(input.paidInstallments, 'Paid installments', 0, totalInstallments),
    notes: input.notes.trim(),
  };
}

export function addLoan(input: db.DebtInput): string {
  const id = db.insertDebt(validLoan(input));
  return `Added loan #${id} ${input.name} (${formatPeso(input.monthlyAmount)}/mo, due day ${input.dueDay})`;
}

export function updateLoan(debtId: number, changes: Partial<db.DebtInput>): string {
  const debt = found(db.getDebtSchedule(debtId), 'Loan');
  db.updateDebt(debtId, validLoan({ ...debt, ...defined(changes) }));
  return `Updated loan ${debt.name}`;
}

export function deleteLoan(debtId: number): string {
  const debt = found(db.getDebtSchedule(debtId), 'Loan');
  db.deleteDebt(debtId);
  return `Deleted loan ${debt.name}`;
}

/* ──────────────────────────── credit cards ─────────────────────────── */

export function updateCard(cardId: number, changes: Partial<db.CardInput>): string {
  const card = found(db.getCreditCard(cardId), 'Card');
  const merged = { ...card, ...defined(changes) };
  db.updateCard(cardId, {
    statementBalance: pesos(merged.statementBalance, 'Statement balance'),
    unbilledAmount: pesos(merged.unbilledAmount, 'Unbilled amount'),
    minimumDue: pesos(merged.minimumDue, 'Minimum due'),
    projectedMonthlySpend: pesos(merged.projectedMonthlySpend, 'Projected spend'),
  });
  return `Updated ${card.name}`;
}

export function setCardStatementPaid(cardId: number, paid: boolean, syncWallet: boolean): string {
  const card = found(db.getCreditCard(cardId), 'Card');
  if (card.paidThisMonth === paid) return `${card.name} statement already ${paid ? 'paid' : 'unpaid'}`;
  if (!paid) {
    const delta = syncWallet ? card.lastPaidAmount : 0;
    db.undoCardSettlement(cardId, delta);
    return `${card.name} statement marked unpaid (${walletNote(delta)})`;
  }
  const bill = currentBill(card, ledgerStart());
  if (!bill) throw new CommandError(`${card.name} has no upcoming statement to settle.`);
  const delta = syncWallet ? -bill.amount : 0;
  db.settleCardStatement(cardId, bill.dueDate, bill.amount, delta);
  return `${card.name} statement due ${bill.dueDate} paid: ${formatPeso(bill.amount)} (${walletNote(delta)})`;
}

export function toggleCardStatementPaid(cardId: number, syncWallet: boolean): string {
  const card = found(db.getCreditCard(cardId), 'Card');
  return setCardStatementPaid(cardId, !card.paidThisMonth, syncWallet);
}

/* ─────────────────────────── quick expenses ────────────────────────── */

export function logExpense(description: string, amount: number): string {
  const value = pesos(amount, 'Expense amount', { allowZero: false });
  const id = db.addQuickExpense(nonEmpty(description, 'Description'), value, todayLocal());
  return `Logged expense #${id} ${description}: -${formatPeso(value)}`;
}

export function deleteExpense(expenseId: number): string {
  const expense = found(db.deleteQuickExpense(expenseId), 'Expense');
  return `Deleted expense ${expense.description}; refunded ${formatPeso(expense.amount)} to wallet`;
}

/* ──────────────────────────── cycle control ────────────────────────── */

export function startNewMonthCycle(): string {
  db.startNewMonthCycle();
  return `Started ${db.getSnapshot().settings.currentMonthLabel} cycle`;
}

export function resetToSeed(): string {
  db.resetToSeed();
  return 'Restored Oct 17, 2026 seed data';
}

export function backupDatabase(): Promise<string> {
  return db.backupDatabase();
}

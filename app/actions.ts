'use server';

import { revalidatePath } from 'next/cache';
import { firstDayOf, maxDate, todayLocal, type IsoDate } from '@/lib/domain/calendar';
import { currentBill } from '@/lib/domain/creditCard';
import { roundPesos } from '@/lib/domain/money';
import { netPay, normalizeAbsences } from '@/lib/domain/payroll';
import * as db from '@/lib/db';

/* ─────────────────────────── input parsing ─────────────────────────── */

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim();
}

function requiredText(form: FormData, key: string): string {
  const value = text(form, key);
  if (!value) throw new Error(`"${key}" is required.`);
  return value;
}

function pesos(form: FormData, key: string): number {
  const value = Number(text(form, key).replace(/[₱,\s]/g, ''));
  if (!Number.isFinite(value)) throw new Error(`"${key}" must be a peso amount.`);
  return roundPesos(value);
}

function nonNegativePesos(form: FormData, key: string): number {
  const value = pesos(form, key);
  if (value < 0) throw new Error(`"${key}" cannot be negative.`);
  return value;
}

function integerInRange(form: FormData, key: string, min: number, max: number): number {
  const value = Number(text(form, key));
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`"${key}" must be a whole number from ${min} to ${max}.`);
  return value;
}

function refresh(): void {
  revalidatePath('/');
}

function ledgerStart(): IsoDate {
  return maxDate(todayLocal(), firstDayOf(db.getSnapshot().settings.cycleMonth));
}

/* ─────────────────────────────── wallet ────────────────────────────── */

export async function syncWalletBalance(form: FormData): Promise<void> {
  db.setWalletBalance(pesos(form, 'balance'));
  refresh();
}

/* ─────────────────────────────── income ────────────────────────────── */

export async function stepAbsences(incomeId: number, period: 'current' | 'next', delta: number): Promise<void> {
  const rule = db.getIncomeRule(incomeId);
  if (!rule?.isPayroll) return;
  const current = period === 'current' ? rule.currentAbsences : rule.nextMonthAbsences;
  db.setAbsences(incomeId, period, normalizeAbsences(current + delta));
  refresh();
}

export async function toggleIncomeReceived(incomeId: number, syncWallet: boolean): Promise<void> {
  const rule = db.getIncomeRule(incomeId);
  if (!rule) return;
  const received = !rule.receivedThisMonth;
  const amount = netPay(rule, rule.currentAbsences);
  db.setIncomeReceived(incomeId, received, syncWallet ? (received ? amount : -amount) : 0);
  refresh();
}

/* ─────────────────────────────── loans ─────────────────────────────── */

export async function toggleDebtPaid(debtId: number, syncWallet: boolean): Promise<void> {
  const debt = db.getDebtSchedule(debtId);
  if (!debt) return;
  const paid = !debt.paidThisMonth;
  const installments = paid ? Math.min(debt.totalInstallments, debt.paidInstallments + 1) : Math.max(0, debt.paidInstallments - 1);
  const walletDelta = syncWallet ? roundPesos((debt.paidInstallments - installments) * debt.monthlyAmount) : 0;
  db.setDebtPaid(debtId, paid, installments, walletDelta);
  refresh();
}

function debtInput(form: FormData): db.DebtInput {
  const totalInstallments = integerInRange(form, 'totalInstallments', 1, 600);
  const monthlyAmount = nonNegativePesos(form, 'monthlyAmount');
  if (monthlyAmount === 0) throw new Error('"monthlyAmount" must be greater than zero.');
  return {
    name: requiredText(form, 'name'),
    lender: text(form, 'lender'),
    dueDay: integerInRange(form, 'dueDay', 1, 31),
    monthlyAmount,
    totalInstallments,
    paidInstallments: integerInRange(form, 'paidInstallments', 0, totalInstallments),
    notes: text(form, 'notes'),
  };
}

export async function saveDebt(form: FormData): Promise<void> {
  const id = Number(text(form, 'id'));
  if (id > 0) db.updateDebt(id, debtInput(form));
  else db.insertDebt(debtInput(form));
  refresh();
}

export async function removeDebt(debtId: number): Promise<void> {
  db.deleteDebt(debtId);
  refresh();
}

/* ──────────────────────────── credit cards ─────────────────────────── */

export async function saveCard(form: FormData): Promise<void> {
  db.updateCard(integerInRange(form, 'id', 1, Number.MAX_SAFE_INTEGER), {
    statementBalance: nonNegativePesos(form, 'statementBalance'),
    unbilledAmount: nonNegativePesos(form, 'unbilledAmount'),
    minimumDue: nonNegativePesos(form, 'minimumDue'),
    projectedMonthlySpend: nonNegativePesos(form, 'projectedMonthlySpend'),
  });
  refresh();
}

export async function toggleCardPaid(cardId: number, syncWallet: boolean): Promise<void> {
  const card = db.getCreditCard(cardId);
  if (!card) return;
  if (card.paidThisMonth) {
    db.undoCardSettlement(cardId, syncWallet ? card.lastPaidAmount : 0);
  } else {
    const bill = currentBill(card, ledgerStart());
    if (!bill) return;
    db.settleCardStatement(cardId, bill.dueDate, bill.amount, syncWallet ? -bill.amount : 0);
  }
  refresh();
}

/* ─────────────────────────── quick expenses ────────────────────────── */

export async function logQuickExpense(form: FormData): Promise<void> {
  const amount = nonNegativePesos(form, 'amount');
  if (amount === 0) throw new Error('"amount" must be greater than zero.');
  db.addQuickExpense(requiredText(form, 'description'), amount, todayLocal());
  refresh();
}

export async function removeQuickExpense(expenseId: number): Promise<void> {
  db.deleteQuickExpense(expenseId);
  refresh();
}

/* ──────────────────────────── cycle control ────────────────────────── */

export async function startNewMonthCycle(): Promise<void> {
  db.startNewMonthCycle();
  refresh();
}

export async function resetToSeed(): Promise<void> {
  db.resetToSeed();
  refresh();
}

export async function backupDatabase(): Promise<string> {
  return db.backupDatabase();
}

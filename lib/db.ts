import 'server-only';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { addMonths, formatMonthLabel, parseYearMonthKey, yearMonthKey, type IsoDate } from './domain/calendar';
import type { CreditCard, DebtSchedule, FinanceSettings, FinanceSnapshot, IncomeRule, QuickExpense } from './domain/types';
import { SEED_CREDIT_CARDS, SEED_DEBT_SCHEDULES, SEED_INCOME_RULES, SEED_SETTINGS } from './seed';

const DB_PATH = path.join(process.cwd(), 'finance.db');
const BACKUP_DIR = path.join(process.cwd(), 'backups');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value
  );
  CREATE TABLE IF NOT EXISTS income_rules (
    id                  INTEGER PRIMARY KEY,
    name                TEXT    NOT NULL,
    day_of_month        INTEGER NOT NULL,
    gross_amount        REAL    NOT NULL,
    fixed_deductions    REAL    NOT NULL DEFAULT 0,
    is_payroll          INTEGER NOT NULL DEFAULT 0,
    absence_rate        REAL    NOT NULL DEFAULT 0,
    current_absences    REAL    NOT NULL DEFAULT 0,
    next_month_absences REAL    NOT NULL DEFAULT 0,
    received_this_month INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS debt_schedules (
    id                 INTEGER PRIMARY KEY,
    name               TEXT    NOT NULL,
    lender             TEXT    NOT NULL DEFAULT '',
    due_day            INTEGER NOT NULL,
    monthly_amount     REAL    NOT NULL,
    total_installments INTEGER NOT NULL,
    paid_installments  INTEGER NOT NULL DEFAULT 0,
    paid_this_month    INTEGER NOT NULL DEFAULT 0,
    notes              TEXT    NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS credit_cards (
    id                      INTEGER PRIMARY KEY,
    name                    TEXT    NOT NULL,
    statement_day           INTEGER NOT NULL,
    due_day                 INTEGER NOT NULL,
    unbilled_amount         REAL    NOT NULL DEFAULT 0,
    statement_balance       REAL    NOT NULL DEFAULT 0,
    minimum_due             REAL    NOT NULL DEFAULT 0,
    paid_this_month         INTEGER NOT NULL DEFAULT 0,
    projected_monthly_spend REAL    NOT NULL DEFAULT 0,
    last_settled_due        TEXT,
    last_paid_amount        REAL    NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS quick_expenses (
    id          INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    amount      REAL NOT NULL,
    date_logged TEXT NOT NULL
  );
`;

const TABLES = ['settings', 'income_rules', 'debt_schedules', 'credit_cards', 'quick_expenses'] as const;

/* ───────────────────────────── connection ───────────────────────────── */

const globalForDb = globalThis as unknown as { financeDb?: Database.Database };

function open(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  if (isEmpty(db)) seed(db);
  return db;
}

function connection(): Database.Database {
  globalForDb.financeDb ??= open();
  return globalForDb.financeDb;
}

function isEmpty(db: Database.Database): boolean {
  const row = db.prepare('SELECT COUNT(*) AS count FROM settings').get() as { count: number };
  return row.count === 0;
}

/* ─────────────────────────────── seeding ────────────────────────────── */

function insertRows(db: Database.Database, table: string, rows: Array<Record<string, unknown>>): void {
  for (const row of rows) {
    const columns = Object.keys(row);
    const placeholders = columns.map((column) => `@${column}`).join(', ');
    db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`).run(row);
  }
}

function seed(db: Database.Database): void {
  db.transaction(() => {
    insertRows(db, 'settings', Object.entries(SEED_SETTINGS).map(([key, value]) => ({ key, value })));
    insertRows(db, 'income_rules', SEED_INCOME_RULES);
    insertRows(db, 'debt_schedules', SEED_DEBT_SCHEDULES);
    insertRows(db, 'credit_cards', SEED_CREDIT_CARDS);
  })();
}

export function resetToSeed(): void {
  const db = connection();
  db.transaction(() => {
    for (const table of TABLES) db.prepare(`DELETE FROM ${table}`).run();
    seed(db);
  })();
}

/* ─────────────────────────────── mapping ────────────────────────────── */

type Row = Record<string, unknown>;
const num = (value: unknown) => Number(value ?? 0);
const bool = (value: unknown) => Number(value) === 1;
const str = (value: unknown) => String(value ?? '');

function toIncomeRule(row: Row): IncomeRule {
  return {
    id: num(row.id),
    name: str(row.name),
    dayOfMonth: num(row.day_of_month),
    grossAmount: num(row.gross_amount),
    fixedDeductions: num(row.fixed_deductions),
    isPayroll: bool(row.is_payroll),
    absenceRate: num(row.absence_rate),
    currentAbsences: num(row.current_absences),
    nextMonthAbsences: num(row.next_month_absences),
    receivedThisMonth: bool(row.received_this_month),
  };
}

function toDebtSchedule(row: Row): DebtSchedule {
  return {
    id: num(row.id),
    name: str(row.name),
    lender: str(row.lender),
    dueDay: num(row.due_day),
    monthlyAmount: num(row.monthly_amount),
    totalInstallments: num(row.total_installments),
    paidInstallments: num(row.paid_installments),
    paidThisMonth: bool(row.paid_this_month),
    notes: str(row.notes),
  };
}

function toCreditCard(row: Row): CreditCard {
  return {
    id: num(row.id),
    name: str(row.name),
    statementDay: num(row.statement_day),
    dueDay: num(row.due_day),
    unbilledAmount: num(row.unbilled_amount),
    statementBalance: num(row.statement_balance),
    minimumDue: num(row.minimum_due),
    paidThisMonth: bool(row.paid_this_month),
    projectedMonthlySpend: num(row.projected_monthly_spend),
    lastSettledDue: row.last_settled_due ? str(row.last_settled_due) : null,
    lastPaidAmount: num(row.last_paid_amount),
  };
}

function toQuickExpense(row: Row): QuickExpense {
  return { id: num(row.id), description: str(row.description), amount: num(row.amount), dateLogged: str(row.date_logged) };
}

/* ─────────────────────────────── queries ────────────────────────────── */

function readSettings(db: Database.Database): FinanceSettings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: unknown }>;
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    walletBalance: num(map.get('wallet_balance')),
    walletName: str(map.get('wallet_name')),
    currentMonthLabel: str(map.get('current_month_label')),
    cycleMonth: parseYearMonthKey(str(map.get('cycle_month'))),
  };
}

export function getSnapshot(): FinanceSnapshot {
  const db = connection();
  return {
    settings: readSettings(db),
    incomes: (db.prepare('SELECT * FROM income_rules ORDER BY day_of_month, id').all() as Row[]).map(toIncomeRule),
    debts: (db.prepare('SELECT * FROM debt_schedules ORDER BY due_day, id').all() as Row[]).map(toDebtSchedule),
    cards: (db.prepare('SELECT * FROM credit_cards ORDER BY id').all() as Row[]).map(toCreditCard),
    expenses: (db.prepare('SELECT * FROM quick_expenses ORDER BY date_logged DESC, id DESC').all() as Row[]).map(toQuickExpense),
  };
}

export function getIncomeRule(id: number): IncomeRule | null {
  const row = connection().prepare('SELECT * FROM income_rules WHERE id = ?').get(id) as Row | undefined;
  return row ? toIncomeRule(row) : null;
}

export function getDebtSchedule(id: number): DebtSchedule | null {
  const row = connection().prepare('SELECT * FROM debt_schedules WHERE id = ?').get(id) as Row | undefined;
  return row ? toDebtSchedule(row) : null;
}

export function getCreditCard(id: number): CreditCard | null {
  const row = connection().prepare('SELECT * FROM credit_cards WHERE id = ?').get(id) as Row | undefined;
  return row ? toCreditCard(row) : null;
}

/* ────────────────────────────── mutations ───────────────────────────── */

function adjustWalletWith(db: Database.Database, delta: number): void {
  db.prepare("UPDATE settings SET value = ROUND(value + ?, 2) WHERE key = 'wallet_balance'").run(delta);
}

export function setWalletBalance(balance: number): void {
  connection().prepare("UPDATE settings SET value = ROUND(?, 2) WHERE key = 'wallet_balance'").run(balance);
}

export function setAbsences(incomeId: number, period: 'current' | 'next', absences: number): void {
  const column = period === 'current' ? 'current_absences' : 'next_month_absences';
  connection().prepare(`UPDATE income_rules SET ${column} = ? WHERE id = ?`).run(absences, incomeId);
}

/** Flips the received flag; `walletDelta` is applied atomically (0 = no sync). */
export function setIncomeReceived(incomeId: number, received: boolean, walletDelta: number): void {
  const db = connection();
  db.transaction(() => {
    db.prepare('UPDATE income_rules SET received_this_month = ? WHERE id = ?').run(received ? 1 : 0, incomeId);
    adjustWalletWith(db, walletDelta);
  })();
}

export function setDebtPaid(debtId: number, paid: boolean, paidInstallments: number, walletDelta: number): void {
  const db = connection();
  db.transaction(() => {
    db.prepare('UPDATE debt_schedules SET paid_this_month = ?, paid_installments = ? WHERE id = ?').run(paid ? 1 : 0, paidInstallments, debtId);
    adjustWalletWith(db, walletDelta);
  })();
}

export interface DebtInput {
  name: string;
  lender: string;
  dueDay: number;
  monthlyAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  notes: string;
}

function debtParams(input: DebtInput) {
  return {
    name: input.name,
    lender: input.lender,
    due_day: input.dueDay,
    monthly_amount: input.monthlyAmount,
    total_installments: input.totalInstallments,
    paid_installments: input.paidInstallments,
    notes: input.notes,
  };
}

export function insertDebt(input: DebtInput): void {
  connection()
    .prepare(
      `INSERT INTO debt_schedules (name, lender, due_day, monthly_amount, total_installments, paid_installments, paid_this_month, notes)
       VALUES (@name, @lender, @due_day, @monthly_amount, @total_installments, @paid_installments, 0, @notes)`,
    )
    .run(debtParams(input));
}

export function updateDebt(id: number, input: DebtInput): void {
  connection()
    .prepare(
      `UPDATE debt_schedules SET name = @name, lender = @lender, due_day = @due_day, monthly_amount = @monthly_amount,
         total_installments = @total_installments, paid_installments = @paid_installments, notes = @notes
       WHERE id = @id`,
    )
    .run({ ...debtParams(input), id });
}

export function deleteDebt(id: number): void {
  connection().prepare('DELETE FROM debt_schedules WHERE id = ?').run(id);
}

export interface CardInput {
  statementBalance: number;
  unbilledAmount: number;
  minimumDue: number;
  projectedMonthlySpend: number;
}

export function updateCard(id: number, input: CardInput): void {
  connection()
    .prepare(
      `UPDATE credit_cards SET statement_balance = @statement_balance, unbilled_amount = @unbilled_amount,
         minimum_due = @minimum_due, projected_monthly_spend = @projected_monthly_spend
       WHERE id = @id`,
    )
    .run({
      id,
      statement_balance: input.statementBalance,
      unbilled_amount: input.unbilledAmount,
      minimum_due: input.minimumDue,
      projected_monthly_spend: input.projectedMonthlySpend,
    });
}

/** Paying a statement zeroes it and remembers what was paid so it can be undone. */
export function settleCardStatement(id: number, dueDate: IsoDate, amount: number, walletDelta: number): void {
  const db = connection();
  db.transaction(() => {
    db.prepare(
      `UPDATE credit_cards SET paid_this_month = 1, last_settled_due = ?, last_paid_amount = ?, statement_balance = 0, minimum_due = 0
       WHERE id = ?`,
    ).run(dueDate, amount, id);
    adjustWalletWith(db, walletDelta);
  })();
}

export function undoCardSettlement(id: number, walletDelta: number): void {
  const db = connection();
  db.transaction(() => {
    db.prepare(
      `UPDATE credit_cards SET paid_this_month = 0, last_settled_due = NULL, statement_balance = last_paid_amount,
         minimum_due = last_paid_amount, last_paid_amount = 0
       WHERE id = ?`,
    ).run(id);
    adjustWalletWith(db, walletDelta);
  })();
}

export function addQuickExpense(description: string, amount: number, dateLogged: IsoDate): void {
  const db = connection();
  db.transaction(() => {
    db.prepare('INSERT INTO quick_expenses (description, amount, date_logged) VALUES (?, ?, ?)').run(description, amount, dateLogged);
    adjustWalletWith(db, -amount);
  })();
}

/** Removing a logged expense refunds it to the wallet. */
export function deleteQuickExpense(id: number): void {
  const db = connection();
  db.transaction(() => {
    const row = db.prepare('SELECT amount FROM quick_expenses WHERE id = ?').get(id) as { amount: number } | undefined;
    if (!row) return;
    db.prepare('DELETE FROM quick_expenses WHERE id = ?').run(id);
    adjustWalletWith(db, row.amount);
  })();
}

/**
 * Rolls the cycle forward one month: clears received/paid flags (installment
 * counts stay) and promotes next-month absences into the new current month.
 */
export function startNewMonthCycle(): void {
  const db = connection();
  db.transaction(() => {
    const next = addMonths(readSettings(db).cycleMonth, 1);
    db.prepare('UPDATE income_rules SET received_this_month = 0, current_absences = next_month_absences, next_month_absences = 0').run();
    db.prepare('UPDATE debt_schedules SET paid_this_month = 0').run();
    db.prepare('UPDATE credit_cards SET paid_this_month = 0').run();
    db.prepare("UPDATE settings SET value = ? WHERE key = 'cycle_month'").run(yearMonthKey(next));
    db.prepare("UPDATE settings SET value = ? WHERE key = 'current_month_label'").run(formatMonthLabel(next));
  })();
}

/** Online, WAL-safe copy of the database into ./backups. */
export async function backupDatabase(): Promise<string> {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(BACKUP_DIR, `finance-${stamp}.db`);
  await connection().backup(file);
  return path.relative(process.cwd(), file);
}

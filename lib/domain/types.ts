import type { IsoDate, YearMonth } from './calendar';

export interface IncomeRule {
  id: number;
  name: string;
  dayOfMonth: number;
  grossAmount: number;
  fixedDeductions: number;
  isPayroll: boolean;
  absenceRate: number;
  currentAbsences: number;
  nextMonthAbsences: number;
  receivedThisMonth: boolean;
}

export interface DebtSchedule {
  id: number;
  name: string;
  lender: string;
  dueDay: number;
  monthlyAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  paidThisMonth: boolean;
  notes: string;
}

export interface CreditCard {
  id: number;
  name: string;
  statementDay: number;
  dueDay: number;
  unbilledAmount: number;
  statementBalance: number;
  minimumDue: number;
  paidThisMonth: boolean;
  projectedMonthlySpend: number;
  lastSettledDue: IsoDate | null;
  lastPaidAmount: number;
}

export interface QuickExpense {
  id: number;
  description: string;
  amount: number;
  dateLogged: IsoDate;
}

export interface FinanceSettings {
  walletBalance: number;
  walletName: string;
  currentMonthLabel: string;
  cycleMonth: YearMonth;
}

export interface FinanceSnapshot {
  settings: FinanceSettings;
  incomes: IncomeRule[];
  debts: DebtSchedule[];
  cards: CreditCard[];
  expenses: QuickExpense[];
}

import { roundPesos } from './money';
import type { IncomeRule } from './types';

export interface DeductionLine {
  label: string;
  amount: number;
}

/** Fixed statutory/HMO deductions taken from every payroll cutoff. */
export const STATUTORY_DEDUCTIONS: readonly DeductionLine[] = [
  { label: 'SSS', amount: 750 },
  { label: 'HDMF', amount: 100 },
  { label: 'PHIC', amount: 375 },
  { label: 'Maxicare', amount: 321 },
];

export const ABSENCE_STEP = 0.5;

/** Absences are only deducted when the user explicitly enters them (> 0). */
export function absenceDeduction(rule: IncomeRule, absences: number): number {
  if (!rule.isPayroll || absences <= 0) return 0;
  return roundPesos(absences * rule.absenceRate);
}

export function netPay(rule: IncomeRule, absences: number): number {
  return roundPesos(rule.grossAmount - rule.fixedDeductions - absenceDeduction(rule, absences));
}

/** Snaps to the nearest half day and never goes negative. */
export function normalizeAbsences(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value / ABSENCE_STEP) * ABSENCE_STEP;
}

export function statutoryBreakdownMatches(rule: IncomeRule): boolean {
  const total = STATUTORY_DEDUCTIONS.reduce((sum, line) => sum + line.amount, 0);
  return roundPesos(total) === roundPesos(rule.fixedDeductions);
}

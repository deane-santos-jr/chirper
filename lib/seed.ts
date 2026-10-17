/**
 * Real-world state as of Oct 17, 2026 (night), after receiving the ₱3,000
 * bridge loan and clearing every October installment:
 * ₱9,030.65 + ₱3,000.00 − ₱10,885.00 = ₱1,145.65.
 */
export const SEED_SETTINGS: Record<string, string | number> = {
  wallet_balance: 1145.65,
  wallet_name: 'MariBank (*2575)',
  current_month_label: 'October 2026',
  cycle_month: '2026-10',
};

export const SEED_INCOME_RULES = [
  { name: 'Service Subscription', day_of_month: 4, gross_amount: 5000, fixed_deductions: 0, is_payroll: 0, absence_rate: 0, current_absences: 0, next_month_absences: 0, received_this_month: 1 },
  { name: 'Activesystems Payroll (10th Cutoff)', day_of_month: 10, gross_amount: 15000, fixed_deductions: 1546, is_payroll: 1, absence_rate: 986.3, current_absences: 0, next_month_absences: 0, received_this_month: 1 },
  { name: 'Retainer Fee', day_of_month: 15, gross_amount: 3500, fixed_deductions: 0, is_payroll: 0, absence_rate: 0, current_absences: 0, next_month_absences: 0, received_this_month: 1 },
  { name: 'Activesystems Payroll (25th Cutoff)', day_of_month: 25, gross_amount: 15000, fixed_deductions: 1546, is_payroll: 1, absence_rate: 986.3, current_absences: 0, next_month_absences: 0, received_this_month: 0 },
];

export const SEED_DEBT_SCHEDULES = [
  { name: 'Installment Loan (₱74.2k)', lender: 'App Loan', due_day: 13, monthly_amount: 8520.52, total_installments: 12, paid_installments: 3, paid_this_month: 1, notes: '9 of 12 unpaid remaining' },
  { name: '₱3k Bridge Loan', lender: 'SLoan', due_day: 17, monthly_amount: 1100.49, total_installments: 3, paid_installments: 0, paid_this_month: 1, notes: '0 Admin Fee • 1st Due Date: 17 Nov 2026' },
  { name: 'GLoan (JKKO8771)', lender: 'Fuse Financing Inc.', due_day: 20, monthly_amount: 2977, total_installments: 12, paid_installments: 3, paid_this_month: 1, notes: '₱8,931.00 of ₱35,724.01 paid (1.59% rate)' },
  { name: '3-Month Cash Loan (₱30k)', lender: 'App Loan (ID: ...7204)', due_day: 22, monthly_amount: 10885, total_installments: 3, paid_installments: 1, paid_this_month: 1, notes: '1/3 Paid Oct 17! Final payment on Dec 22, 2026' },
];

export const SEED_CREDIT_CARDS = [
  { name: 'Atome Credit Card', statement_day: 22, due_day: 1, unbilled_amount: 10579.6, statement_balance: 10579.6, minimum_due: 10579.6, paid_this_month: 0, projected_monthly_spend: 0, last_settled_due: null, last_paid_amount: 0 },
];

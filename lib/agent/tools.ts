import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import * as commands from '@/lib/commands';
import type { IsoDate } from '@/lib/domain/calendar';
import { financialState } from './state';

type Schema = Anthropic.Beta.BetaTool['input_schema'];
type Input = Record<string, unknown>;

/** Reads a tool input field, rejecting the wrong type so a bad call becomes a tool error. */
class ToolInput {
  constructor(private readonly input: Input) {}

  number(key: string): number {
    const value = this.input[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new commands.CommandError(`"${key}" must be a number.`);
    return value;
  }

  string(key: string): string {
    const value = this.input[key];
    if (typeof value !== 'string') throw new commands.CommandError(`"${key}" must be a string.`);
    return value;
  }

  boolean(key: string): boolean {
    const value = this.input[key];
    if (typeof value !== 'boolean') throw new commands.CommandError(`"${key}" must be true or false.`);
    return value;
  }

  period(key: string): 'current' | 'next' {
    const value = this.string(key);
    if (value !== 'current' && value !== 'next') throw new commands.CommandError(`"${key}" must be "current" or "next".`);
    return value;
  }

  /** Only the fields the model actually sent, so partial updates never blank out others. */
  present<T extends string>(keys: Record<T, 'number' | 'string' | 'boolean'>): Partial<Record<T, number | string | boolean>> {
    const result: Partial<Record<T, number | string | boolean>> = {};
    for (const [key, type] of Object.entries(keys) as Array<[T, 'number' | 'string' | 'boolean']>) {
      if (this.input[key] === undefined || this.input[key] === null) continue;
      result[key] = type === 'number' ? this.number(key) : type === 'string' ? this.string(key) : this.boolean(key);
    }
    return result;
  }
}

interface AgentTool {
  definition: Anthropic.Beta.BetaTool;
  run: (input: ToolInput, today: IsoDate) => string;
}

const id = (description: string) => ({ type: 'integer', description });
const pesos = (description: string) => ({ type: 'number', description: `${description} (pesos)` });
const syncWallet = {
  type: 'boolean',
  description:
    'true = also move the live wallet balance by this amount. false = flag only (use when the user already gave you their new exact balance, or the wallet already reflects it).',
};

function schema(properties: Record<string, unknown>, required: string[] = Object.keys(properties)): Schema {
  return { type: 'object', properties, required, additionalProperties: false };
}

function tool(name: string, description: string, input_schema: Schema, run: AgentTool['run']): AgentTool {
  return { definition: { name, description, input_schema }, run };
}

const TOOLS: AgentTool[] = [
  tool(
    'get_financial_state',
    'Read the full current state: wallet, incomes, loans, credit cards, recent expenses, and the forward running-balance ledger with the lowest point and any shortfall. Call it before making changes and whenever you need current numbers.',
    schema({}),
    (_input, today) => JSON.stringify(financialState(today)),
  ),
  tool(
    'set_wallet_balance',
    'Overwrite the live wallet balance with the exact amount the user reports from their bank app.',
    schema({ balance: pesos('Exact current wallet balance') }),
    (input) => commands.setWalletBalance(input.number('balance')),
  ),
  tool(
    'log_expense',
    'Log a one-off pocket expense (food, gas, load, etc.). Deducts it from the wallet immediately.',
    schema({ description: { type: 'string' }, amount: pesos('Amount spent') }),
    (input) => commands.logExpense(input.string('description'), input.number('amount')),
  ),
  tool(
    'delete_expense',
    'Delete a logged pocket expense by id and refund it to the wallet.',
    schema({ expense_id: id('Expense id') }),
    (input) => commands.deleteExpense(input.number('expense_id')),
  ),
  tool(
    'set_income_received',
    'Mark an income as received (or back to pending) for the current cycle month.',
    schema({ income_id: id('Income id'), received: { type: 'boolean' }, sync_wallet: syncWallet }),
    (input) => commands.setIncomeReceived(input.number('income_id'), input.boolean('received'), input.boolean('sync_wallet')),
  ),
  tool(
    'set_absences',
    'Set absence days for a payroll cutoff. period "current" = this cycle month, "next" = next month. Half days allowed (0.5 steps). 0 clears them.',
    schema({ income_id: id('Payroll income id'), period: { type: 'string', enum: ['current', 'next'] }, days: { type: 'number' } }),
    (input) => commands.setAbsences(input.number('income_id'), input.period('period'), input.number('days')),
  ),
  tool(
    'add_income',
    'Add a new recurring monthly income.',
    schema({
      name: { type: 'string' },
      day_of_month: { type: 'integer' },
      gross_amount: pesos('Gross amount per occurrence'),
      fixed_deductions: pesos('Fixed deductions per occurrence, 0 if none'),
      is_payroll: { type: 'boolean', description: 'true if absences can reduce it' },
      absence_rate: pesos('Deduction per absence day, 0 if not payroll'),
    }),
    (input) =>
      commands.addIncome({
        name: input.string('name'),
        dayOfMonth: input.number('day_of_month'),
        grossAmount: input.number('gross_amount'),
        fixedDeductions: input.number('fixed_deductions'),
        isPayroll: input.boolean('is_payroll'),
        absenceRate: input.number('absence_rate'),
      }),
  ),
  tool(
    'update_income',
    'Change fields of an existing income. Send only the fields that change.',
    schema(
      {
        income_id: id('Income id'),
        name: { type: 'string' },
        day_of_month: { type: 'integer' },
        gross_amount: pesos('Gross amount'),
        fixed_deductions: pesos('Fixed deductions'),
        absence_rate: pesos('Deduction per absence day'),
      },
      ['income_id'],
    ),
    (input) => {
      const fields = input.present({ name: 'string', day_of_month: 'number', gross_amount: 'number', fixed_deductions: 'number', absence_rate: 'number' });
      return commands.updateIncome(input.number('income_id'), {
        name: fields.name as string | undefined,
        dayOfMonth: fields.day_of_month as number | undefined,
        grossAmount: fields.gross_amount as number | undefined,
        fixedDeductions: fields.fixed_deductions as number | undefined,
        absenceRate: fields.absence_rate as number | undefined,
      });
    },
  ),
  tool(
    'set_loan_paid',
    "Mark a loan's installment for the current cycle month as paid (increments installments paid) or undo it.",
    schema({ loan_id: id('Loan id'), paid: { type: 'boolean' }, sync_wallet: syncWallet }),
    (input) => commands.setLoanPaid(input.number('loan_id'), input.boolean('paid'), input.boolean('sync_wallet')),
  ),
  tool(
    'add_loan',
    'Add a new installment loan.',
    schema({
      name: { type: 'string' },
      lender: { type: 'string' },
      due_day: { type: 'integer', description: 'Day of month the installment is due' },
      monthly_amount: pesos('Installment amount'),
      total_installments: { type: 'integer' },
      paid_installments: { type: 'integer', description: 'Installments already paid' },
      notes: { type: 'string' },
    }),
    (input) =>
      commands.addLoan({
        name: input.string('name'),
        lender: input.string('lender'),
        dueDay: input.number('due_day'),
        monthlyAmount: input.number('monthly_amount'),
        totalInstallments: input.number('total_installments'),
        paidInstallments: input.number('paid_installments'),
        notes: input.string('notes'),
      }),
  ),
  tool(
    'update_loan',
    'Change fields of an existing loan. Send only the fields that change.',
    schema(
      {
        loan_id: id('Loan id'),
        name: { type: 'string' },
        lender: { type: 'string' },
        due_day: { type: 'integer' },
        monthly_amount: pesos('Installment amount'),
        total_installments: { type: 'integer' },
        paid_installments: { type: 'integer' },
        notes: { type: 'string' },
      },
      ['loan_id'],
    ),
    (input) => {
      const fields = input.present({
        name: 'string',
        lender: 'string',
        due_day: 'number',
        monthly_amount: 'number',
        total_installments: 'number',
        paid_installments: 'number',
        notes: 'string',
      });
      return commands.updateLoan(input.number('loan_id'), {
        name: fields.name as string | undefined,
        lender: fields.lender as string | undefined,
        dueDay: fields.due_day as number | undefined,
        monthlyAmount: fields.monthly_amount as number | undefined,
        totalInstallments: fields.total_installments as number | undefined,
        paidInstallments: fields.paid_installments as number | undefined,
        notes: fields.notes as string | undefined,
      });
    },
  ),
  tool(
    'delete_loan',
    'Permanently delete a loan. Only after the user explicitly confirms.',
    schema({ loan_id: id('Loan id') }),
    (input) => commands.deleteLoan(input.number('loan_id')),
  ),
  tool(
    'update_credit_card',
    'Update credit card figures. Send only the fields that change.',
    schema(
      {
        card_id: id('Card id'),
        statement_balance: pesos('Amount payable on the next due date'),
        unbilled_amount: pesos('Spend not yet on a statement'),
        minimum_due: pesos('Minimum amount due'),
        projected_monthly_spend: pesos('Expected spend for each future statement'),
      },
      ['card_id'],
    ),
    (input) => {
      const fields = input.present({ statement_balance: 'number', unbilled_amount: 'number', minimum_due: 'number', projected_monthly_spend: 'number' });
      return commands.updateCard(input.number('card_id'), {
        statementBalance: fields.statement_balance as number | undefined,
        unbilledAmount: fields.unbilled_amount as number | undefined,
        minimumDue: fields.minimum_due as number | undefined,
        projectedMonthlySpend: fields.projected_monthly_spend as number | undefined,
      });
    },
  ),
  tool(
    'set_card_statement_paid',
    "Mark the card's upcoming statement as paid (zeroes it) or undo that.",
    schema({ card_id: id('Card id'), paid: { type: 'boolean' }, sync_wallet: syncWallet }),
    (input) => commands.setCardStatementPaid(input.number('card_id'), input.boolean('paid'), input.boolean('sync_wallet')),
  ),
  tool(
    'start_new_month_cycle',
    'Roll to the next month cycle: clears received/paid flags, keeps installment counts, moves next-month absences to current. Only after the user confirms.',
    schema({}),
    () => commands.startNewMonthCycle(),
  ),
];

const BY_NAME = new Map(TOOLS.map((entry) => [entry.definition.name, entry]));

export const AGENT_TOOLS: Anthropic.Beta.BetaTool[] = TOOLS.map((entry) => entry.definition);

/** Tools that change data (everything except the read). */
export function isMutation(name: string): boolean {
  return name !== 'get_financial_state';
}

export function runAgentTool(name: string, input: unknown, today: IsoDate): { content: string; isError: boolean } {
  const entry = BY_NAME.get(name);
  if (!entry) return { content: `Unknown tool "${name}".`, isError: true };
  try {
    return { content: entry.run(new ToolInput((input ?? {}) as Input), today), isError: false };
  } catch (error) {
    if (error instanceof commands.CommandError) return { content: error.message, isError: true };
    throw error;
  }
}

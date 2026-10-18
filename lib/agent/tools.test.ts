import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const TODAY = '2026-10-17';
vi.mock('@/lib/domain/calendar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/domain/calendar')>()),
  todayLocal: () => TODAY,
}));

type Tools = typeof import('./tools');
type Db = typeof import('@/lib/db');
let tools: Tools;
let db: Db;

const run = (name: string, input: unknown = {}) => tools.runAgentTool(name, input, TODAY);
const wallet = () => db.getSnapshot().settings.walletBalance;

beforeAll(async () => {
  process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'fin-agent-')));
  tools = await import('./tools');
  db = await import('@/lib/db');
});

describe('agent tools against a seeded database', () => {
  it('reads the full state with ids and the runway', () => {
    const state = JSON.parse(run('get_financial_state').content);
    expect(state.wallet.balance).toBe(1145.65);
    expect(state.loans).toHaveLength(4);
    expect(state.runway.lowestPoint).toEqual({ date: '2026-10-17', balance: 1145.65 });
  });

  it('logs an expense and deducts it from the wallet', () => {
    expect(run('log_expense', { description: 'Lunch', amount: 250 })).toEqual({ content: 'Logged expense #1 Lunch: -₱250.00', isError: false });
    expect(wallet()).toBe(895.65);
  });

  it('marks payroll received and moves the wallet when asked to', () => {
    run('set_income_received', { income_id: 4, received: true, sync_wallet: true });
    expect(wallet()).toBe(14349.65);
  });

  it('pays the card statement and the ledger moves to the next statement', () => {
    run('set_card_statement_paid', { card_id: 1, paid: true, sync_wallet: true });
    expect(wallet()).toBe(3770.05);
    const state = JSON.parse(run('get_financial_state').content);
    expect(state.creditCards[0].upcomingBill).toMatchObject({ dueDate: '2026-12-01', amount: 0 });
  });

  it('updates only the loan fields that were sent', () => {
    run('update_loan', { loan_id: 2, notes: 'Renegotiated' });
    expect(db.getDebtSchedule(2)).toMatchObject({ name: '₱3k Bridge Loan', monthlyAmount: 1100.49, notes: 'Renegotiated' });
  });

  it('sets absences in half-day steps', () => {
    run('set_absences', { income_id: 2, period: 'next', days: 1.4 });
    expect(db.getIncomeRule(2)?.nextMonthAbsences).toBe(1.5);
  });

  it('returns tool errors instead of throwing on bad input', () => {
    expect(run('log_expense', { description: 'Gas', amount: -5 }).isError).toBe(true);
    expect(run('set_loan_paid', { loan_id: 99, paid: true, sync_wallet: false })).toEqual({ content: 'Loan not found.', isError: true });
    expect(run('set_absences', { income_id: 1, period: 'current', days: 1 }).isError).toBe(true);
    expect(run('no_such_tool').isError).toBe(true);
  });
});

describe('transcript view', () => {
  it('folds the raw API thread into chat bubbles with change chips', async () => {
    const { todaysTranscript } = await import('./transcript');
    db.appendAgentMessages(TODAY, [
      { role: 'user', content: [{ type: 'text', text: '[Today is Saturday, 2026-10-17]\n\nSpent 100 on load' }] },
      { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'get_financial_state', input: {} }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '{}' }] },
      { role: 'assistant', content: [{ type: 'tool_use', id: 't2', name: 'log_expense', input: { description: 'Load', amount: 100 } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't2', content: 'Logged expense #2 Load: -₱100.00' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Logged ₱100.00 load.' }] },
    ]);
    expect(todaysTranscript()).toEqual([
      { id: 'u0', role: 'user', text: 'Spent 100 on load', imageCount: 0, changes: [] },
      {
        id: 'a1',
        role: 'assistant',
        text: 'Logged ₱100.00 load.',
        imageCount: 0,
        changes: [{ text: 'Logged expense #2 Load: -₱100.00', failed: false }],
      },
    ]);
  });
});

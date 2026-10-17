'use client';

import { Loader2, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useRef, useTransition } from 'react';
import { logQuickExpense, removeQuickExpense } from '@/app/actions';
import { Money } from '@/components/ui/Money';
import { Panel } from '@/components/ui/Panel';
import { formatShortDate } from '@/lib/domain/calendar';
import type { QuickExpense } from '@/lib/domain/types';

const VISIBLE_EXPENSES = 8;

interface QuickExpensePanelProps {
  expenses: QuickExpense[];
  walletBalance: number;
  cycleKey: string;
  paydayLabel: string;
}

export function QuickExpensePanel({ expenses, walletBalance, cycleKey, paydayLabel }: QuickExpensePanelProps) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const cycleTotal = expenses.filter((expense) => expense.dateLogged.startsWith(cycleKey)).reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <Panel
      title="Pocket Expenses"
      subtitle={`Logged spend deducts from the wallet instantly. Buffer left until ${paydayLabel}.`}
      icon={ShoppingBag}
      actions={
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Buffer left</p>
          <Money value={walletBalance} tone={walletBalance < 0 ? 'outflow' : 'safe'} className="text-sm font-semibold" />
        </div>
      }
    >
      <form
        ref={formRef}
        action={(form) =>
          startTransition(async () => {
            await logQuickExpense(form);
            formRef.current?.reset();
          })
        }
        className="flex gap-2"
      >
        <input name="description" required placeholder="Groceries, gas, load…" className="field" />
        <input name="amount" type="number" step="0.01" min="0.01" required placeholder="₱0.00" className="field-money w-32 shrink-0" />
        <button type="submit" className="btn-primary shrink-0" disabled={isPending}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Log
        </button>
      </form>

      {expenses.length > 0 && (
        <>
          <ul className="mt-3 divide-y divide-slate-800 text-sm">
            {expenses.slice(0, VISIBLE_EXPENSES).map((expense) => (
              <li key={expense.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="w-14 shrink-0 text-xs text-slate-500">{formatShortDate(expense.dateLogged)}</span>
                <span className="min-w-0 flex-1 truncate text-slate-300">{expense.description}</span>
                <Money value={-expense.amount} tone="outflow" />
                <button
                  type="button"
                  aria-label="Delete expense and refund wallet"
                  className="text-slate-600 hover:text-rose-400"
                  onClick={() => startTransition(() => removeQuickExpense(expense.id))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-right text-xs text-slate-500">
            This cycle: <Money value={-cycleTotal} tone="outflow" />
          </p>
        </>
      )}
    </Panel>
  );
}

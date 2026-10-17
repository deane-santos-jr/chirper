'use client';

import { CreditCard as CardIcon, Loader2, Save, ShieldCheck } from 'lucide-react';
import { useTransition } from 'react';
import { saveCard, toggleCardPaid } from '@/app/actions';
import { Badge } from '@/components/ui/Badge';
import { Money } from '@/components/ui/Money';
import { Panel } from '@/components/ui/Panel';
import { SettleToggle } from '@/components/ui/SettleToggle';
import { formatShortDate, ordinal } from '@/lib/domain/calendar';
import type { CardBill } from '@/lib/domain/creditCard';
import { formatPeso } from '@/lib/domain/money';
import type { CreditCard } from '@/lib/domain/types';

export interface CardInsight {
  card: CreditCard;
  bill: CardBill | null;
  nextBill: CardBill | null;
  /** Max spend for the next statement alone that keeps the ledger ≥ ₱0. */
  nextBillCeiling: number | null;
}

function MoneyField({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <label>
      <span className="label">{label}</span>
      <input key={value} name={name} type="number" step="0.01" min="0" required defaultValue={value.toFixed(2)} className="field-money" />
    </label>
  );
}

function CardRow({ card, bill, nextBill, nextBillCeiling }: CardInsight) {
  const [isPending, startTransition] = useTransition();
  const ceilingTone = nextBill && nextBillCeiling !== null && nextBill.amount > nextBillCeiling ? 'outflow' : 'inflow';

  return (
    <li className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium text-slate-100">{card.name}</span>
          <Badge tone="info">Bills every {ordinal(card.statementDay)}</Badge>
          <Badge tone="outflow">Due every {ordinal(card.dueDay)}</Badge>
        </div>
        <SettleToggle
          settled={card.paidThisMonth}
          settledLabel="Statement Paid ✓"
          pendingLabel="Statement Unpaid"
          amount={card.paidThisMonth ? card.lastPaidAmount : (bill?.amount ?? 0)}
          direction="out"
          onToggle={(syncWallet) => toggleCardPaid(card.id, syncWallet)}
        />
      </div>

      {bill && (
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs">
          <div>
            <p className="text-slate-500">Statement cuts</p>
            <p className="font-medium text-sky-400">{formatShortDate(bill.statementDate)}</p>
            <p className="text-[11px] text-slate-500">₱0.00 outflow</p>
          </div>
          <div>
            <p className="text-slate-500">Cash leaves</p>
            <p className="font-medium text-rose-400">{formatShortDate(bill.dueDate)}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-500">Amount</p>
            <Money value={bill.amount} tone="outflow" className="font-semibold" />
          </div>
        </div>
      )}

      <form action={(form) => startTransition(() => saveCard(form))} className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <input type="hidden" name="id" value={card.id} />
        <MoneyField name="statementBalance" label="Statement balance" value={card.statementBalance} />
        <MoneyField name="unbilledAmount" label="Unbilled spend" value={card.unbilledAmount} />
        <MoneyField name="minimumDue" label="Minimum due" value={card.minimumDue} />
        <MoneyField name="projectedMonthlySpend" label="Next month projected" value={card.projectedMonthlySpend} />
        <div className="col-span-2 flex justify-end sm:col-span-4">
          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Update card
          </button>
        </div>
      </form>

      {nextBill && nextBillCeiling !== null && (
        <p className="flex items-start gap-1.5 rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-xs text-slate-300">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span>
            Keep the {formatShortDate(nextBill.statementDate)} statement (due {formatShortDate(nextBill.dueDate)}) under{' '}
            <Money value={nextBillCeiling} tone={ceilingTone} className="font-semibold" /> to keep every ledger row ≥ ₱0.00. Projected:{' '}
            <span className="font-mono tabular-nums">{formatPeso(nextBill.amount)}</span>.
          </span>
        </p>
      )}
    </li>
  );
}

export function CreditCardPanel({ insights }: { insights: CardInsight[] }) {
  return (
    <Panel title="Credit Card Statement & Unbilled Tracker" subtitle="Statement day is info only; cash leaves on the due day." icon={CardIcon}>
      {insights.length === 0 ? (
        <p className="text-sm text-slate-500">No credit cards tracked.</p>
      ) : (
        <ul className="space-y-6">
          {insights.map((insight) => (
            <CardRow key={insight.card.id} {...insight} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

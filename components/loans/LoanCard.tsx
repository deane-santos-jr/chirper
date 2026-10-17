'use client';

import { CalendarClock, Pencil, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { removeDebt, toggleDebtPaid } from '@/app/actions';
import { Badge } from '@/components/ui/Badge';
import { Money } from '@/components/ui/Money';
import { SettleToggle } from '@/components/ui/SettleToggle';
import { formatShortDate, ordinal, type IsoDate } from '@/lib/domain/calendar';
import type { DebtSchedule } from '@/lib/domain/types';
import { LoanForm } from './LoanForm';

export interface LoanCardProps {
  debt: DebtSchedule;
  cycleMonthShort: string;
  remainingBalance: number;
  nextInstallment: { date: IsoDate; installmentNumber: number } | null;
}

export function LoanCard({ debt, cycleMonthShort, remainingBalance, nextInstallment }: LoanCardProps) {
  const [editing, setEditing] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const progress = Math.min(100, (debt.paidInstallments / debt.totalInstallments) * 100);
  const finished = debt.paidInstallments >= debt.totalInstallments;

  if (editing) {
    return (
      <li className="rounded-lg border border-sky-500/30 bg-slate-950/60 p-3">
        <LoanForm debt={debt} onDone={() => setEditing(false)} />
      </li>
    );
  }

  const confirmDelete = () => {
    if (window.confirm(`Delete "${debt.name}"? This cannot be undone.`)) startDelete(() => removeDebt(debt.id));
  };

  return (
    <li className={`rounded-lg border border-slate-800 bg-slate-950/40 p-3 ${isDeleting ? 'opacity-40' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="outflow">Due {ordinal(debt.dueDay)}</Badge>
            <span className="text-sm font-medium text-slate-100">{debt.name}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{debt.lender}</p>
        </div>
        <div className="text-right">
          <Money value={debt.monthlyAmount} tone="outflow" className="text-lg font-semibold" />
          <p className="text-[11px] text-slate-500">per month</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[11px]">
          <span className={finished ? 'text-emerald-400' : 'text-slate-400'}>
            {debt.paidInstallments}/{debt.totalInstallments} Paid{finished && ' — Fully paid 🎉'}
          </span>
          <span className="text-slate-500">
            Remaining: <Money value={remainingBalance} tone={remainingBalance > 0 ? 'warning' : 'inflow'} />
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {debt.notes && <p className="mt-2 text-[11px] text-slate-500">{debt.notes}</p>}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[11px] text-slate-400">
          <CalendarClock className="h-3.5 w-3.5" />
          {nextInstallment
            ? `Next: ${formatShortDate(nextInstallment.date)} (${nextInstallment.installmentNumber}/${debt.totalInstallments})`
            : 'No installments left'}
        </span>
        <div className="flex items-center gap-1.5">
          <SettleToggle
            settled={debt.paidThisMonth}
            settledLabel={`Paid ${cycleMonthShort} ✓`}
            pendingLabel={`Unpaid ${cycleMonthShort}`}
            amount={debt.paidThisMonth ? (debt.paidInstallments > 0 ? debt.monthlyAmount : 0) : finished ? 0 : debt.monthlyAmount}
            direction="out"
            onToggle={(syncWallet) => toggleDebtPaid(debt.id, syncWallet)}
          />
          <button type="button" className="btn-neutral px-1.5" aria-label="Edit loan" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="btn-danger px-1.5" aria-label="Delete loan" onClick={confirmDelete} disabled={isDeleting}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

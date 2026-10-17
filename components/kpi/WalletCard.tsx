'use client';

import { Loader2, RefreshCw, Wallet } from 'lucide-react';
import { useTransition } from 'react';
import { syncWalletBalance } from '@/app/actions';
import { Badge } from '@/components/ui/Badge';
import { Money } from '@/components/ui/Money';
import { formatShortDate } from '@/lib/domain/calendar';
import { formatPeso } from '@/lib/domain/money';
import type { SafeSpend } from '@/lib/domain/insights';
import { KpiCard } from './KpiCard';

export function WalletCard({ walletName, balance, safeSpend }: { walletName: string; balance: number; safeSpend: SafeSpend }) {
  const [isPending, startTransition] = useTransition();
  const paydayLabel = safeSpend.payday ? formatShortDate(safeSpend.payday.date) : 'next payday';

  return (
    <KpiCard label={`Live ${walletName}`} icon={Wallet}>
      <Money value={balance} tone={balance < 0 ? 'outflow' : 'safe'} className="text-3xl font-semibold" />
      <form
        action={(form) => startTransition(() => syncWalletBalance(form))}
        className="mt-3 flex gap-2"
      >
        <input
          key={balance}
          name="balance"
          type="number"
          step="0.01"
          inputMode="decimal"
          defaultValue={balance.toFixed(2)}
          aria-label="Exact wallet balance"
          className="field-money"
        />
        <button type="submit" className="btn-primary shrink-0" disabled={isPending}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Sync
        </button>
      </form>
      <div className="mt-auto pt-3">
        <Badge tone="warning" className="whitespace-normal">
          Daily Safe Spend Until Next Payday ({paydayLabel}):{' '}
          <span className="font-mono tabular-nums">{formatPeso(safeSpend.dailySafeSpend)}/day</span>
        </Badge>
        <p className="mt-1.5 text-[11px] text-slate-500">
          {safeSpend.daysUntilPayday} day(s) left
          {safeSpend.obligationsBeforePayday > 0 && ` • ${formatPeso(safeSpend.obligationsBeforePayday)} due before payday reserved`}
        </p>
      </div>
    </KpiCard>
  );
}

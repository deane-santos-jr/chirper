'use client';

import { SlidersHorizontal } from 'lucide-react';
import { formatShortDate } from '@/lib/domain/calendar';
import type { SpendCeiling } from '@/lib/domain/insights';
import { formatPeso } from '@/lib/domain/money';

const STEP = 100;

interface SimulatorProps {
  value: number;
  onChange: (value: number) => void;
  ceiling: SpendCeiling;
}

export function LivingSpendSimulator({ value, onChange, ceiling }: SimulatorProps) {
  const max = Math.max(20_000, Math.ceil((ceiling.monthlyCeiling * 2) / 1000) * 1000);
  const overCeiling = value > ceiling.monthlyCeiling;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="living-spend" className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
          <SlidersHorizontal className="h-3.5 w-3.5 text-amber-400" />
          Simulate Monthly Living / Food / Gas Spend
        </label>
        <input
          type="number"
          min={0}
          step={STEP}
          value={value}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
          aria-label="Monthly living spend in pesos"
          className="field-money w-28 py-1 text-right text-xs"
        />
      </div>
      <input
        id="living-spend"
        type="range"
        min={0}
        max={max}
        step={STEP}
        value={Math.min(value, max)}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-amber-400"
      />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className={overCeiling ? 'text-rose-400' : 'text-slate-400'}>
          Max safe: <span className="font-mono tabular-nums text-emerald-400">{formatPeso(ceiling.monthlyCeiling)}/mo</span> (≈
          <span className="font-mono tabular-nums">{formatPeso(ceiling.monthlyCeiling / 30)}</span>/day)
          {ceiling.bindingEvent && ` • tightest on ${formatShortDate(ceiling.bindingEvent.date)}`}
        </span>
        <span className="flex gap-1.5">
          <button type="button" className="btn-neutral py-0.5" onClick={() => onChange(Math.floor(ceiling.monthlyCeiling / STEP) * STEP)}>
            Use max
          </button>
          <button type="button" className="btn-neutral py-0.5" onClick={() => onChange(0)}>
            Clear
          </button>
        </span>
      </div>
    </div>
  );
}

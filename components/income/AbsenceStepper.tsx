'use client';

import { useTransition } from 'react';
import { stepAbsences } from '@/app/actions';
import { Badge } from '@/components/ui/Badge';
import { formatPeso } from '@/lib/domain/money';

const STEPS = [
  { label: '-0.5', delta: -0.5 },
  { label: '+0.5', delta: 0.5 },
  { label: '+1', delta: 1 },
];

interface AbsenceStepperProps {
  incomeId: number;
  period: 'current' | 'next';
  monthLabel: string;
  absences: number;
  absenceRate: number;
}

export function AbsenceStepper({ incomeId, period, monthLabel, absences, absenceRate }: AbsenceStepperProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 text-[11px] uppercase tracking-wide text-slate-500">{monthLabel} absences</span>
      <div className="flex items-center overflow-hidden rounded-md border border-slate-700">
        {STEPS.map((step) => (
          <button
            key={step.label}
            type="button"
            disabled={isPending || (step.delta < 0 && absences <= 0)}
            onClick={() => startTransition(() => stepAbsences(incomeId, period, step.delta))}
            className="border-r border-slate-700 bg-slate-800 px-2 py-1 font-mono text-xs text-slate-300 last:border-r-0 hover:bg-slate-700 disabled:opacity-40"
          >
            {step.label}
          </button>
        ))}
      </div>
      <span className={`w-10 text-center font-mono text-sm tabular-nums ${absences > 0 ? 'text-amber-400' : 'text-slate-400'}`}>{absences}</span>
      {absences > 0 && (
        <Badge tone="warning">
          -{formatPeso(absenceRate)} × {absences} day(s) deducted
        </Badge>
      )}
    </div>
  );
}

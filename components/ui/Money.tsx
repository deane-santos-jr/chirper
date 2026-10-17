import { formatPeso, formatSignedPeso } from '@/lib/domain/money';

export type Tone = 'inflow' | 'outflow' | 'warning' | 'safe' | 'muted' | 'plain';

export const TONE_TEXT: Record<Tone, string> = {
  inflow: 'text-emerald-400',
  outflow: 'text-rose-400',
  warning: 'text-amber-400',
  safe: 'text-sky-400',
  muted: 'text-slate-500',
  plain: 'text-slate-100',
};

interface MoneyProps {
  value: number;
  tone?: Tone;
  signed?: boolean;
  className?: string;
}

export function Money({ value, tone = 'plain', signed = false, className = '' }: MoneyProps) {
  return (
    <span className={`font-mono tabular-nums ${TONE_TEXT[tone]} ${className}`}>
      {signed ? formatSignedPeso(value) : formatPeso(value)}
    </span>
  );
}

/** Tone for a signed cash movement. */
export function flowTone(amount: number): Tone {
  if (amount > 0) return 'inflow';
  if (amount < 0) return 'outflow';
  return 'muted';
}

/** Tone for a running balance. */
export function balanceTone(balance: number): Tone {
  return balance < 0 ? 'outflow' : 'safe';
}

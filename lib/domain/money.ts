/**
 * Money is computed in integer centavos so a long chain of running-balance
 * additions never drifts by a floating-point centavo.
 */
export type Centavos = number;

export function toCentavos(pesos: number): Centavos {
  return Math.round(pesos * 100);
}

export function toPesos(centavos: Centavos): number {
  return centavos / 100;
}

export function roundPesos(pesos: number): number {
  return toPesos(toCentavos(pesos));
}

const pesoFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₱13,454.00 — negative values render as -₱1,234.56. */
export function formatPeso(pesos: number): string {
  const sign = pesos < 0 ? '-' : '';
  return `${sign}₱${pesoFormatter.format(Math.abs(pesos))}`;
}

/** +₱13,454.00 / -₱10,579.60 — for signed cash-flow amounts. */
export function formatSignedPeso(pesos: number): string {
  if (pesos > 0) return `+${formatPeso(pesos)}`;
  return formatPeso(pesos);
}

/**
 * MDR helpers.
 *
 * Convention: `merchants.mdr_rate` stores the MDR as a literal percentage
 * (e.g. 1.8 means 1.8%). NEVER multiply by 100 for display or divide by 100
 * for computation without going through these helpers.
 */

export const MDR_DECIMAL_MAX = 3;

/** Format a stored MDR value as a percentage string, trimming trailing zeros. */
export function formatMdrPercent(
  rate: number | null | undefined,
  maxDigits: number = MDR_DECIMAL_MAX,
): string {
  const n = Number(rate ?? 0);
  if (!Number.isFinite(n)) return "0%";
  const fixed = n.toFixed(maxDigits);
  const trimmed = fixed.replace(/\.?0+$/, "");
  return `${trimmed}%`;
}

/** Fraction used to compute deductions from an amount (mdr% of amount). */
export function mdrFraction(rate: number | null | undefined): number {
  const n = Number(rate ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n / 100;
}

/** Client-side validator mirroring the server CHECK constraint. */
export function validateMdrInput(raw: string | number): {
  ok: boolean;
  value: number;
  error?: string;
} {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).trim());
  if (!Number.isFinite(n)) return { ok: false, value: 0, error: "MDR must be a number" };
  if (n < 0) return { ok: false, value: n, error: "MDR must be zero or positive" };
  if (n > 100) return { ok: false, value: n, error: "MDR cannot exceed 100%" };
  return { ok: true, value: n };
}

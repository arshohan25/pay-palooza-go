/**
 * Islamic Savings & DPS — return estimators.
 * Mudarabah (profit-sharing) model. Indicative only, not guaranteed.
 * Hard cap: 6% annual.
 */

export type Strategy = "gold" | "stocks" | "balanced" | "conservative";
export type Frequency = "daily" | "weekly" | "monthly";

export const STRATEGY_RETURNS: Record<Strategy, { annual: number; label: string; desc: string }> = {
  gold:          { annual: 0.058, label: "Gold-backed",      desc: "Sharia gold trade" },
  stocks:        { annual: 0.060, label: "Halal Equities",   desc: "DSE Sharia-compliant" },
  balanced:      { annual: 0.050, label: "Balanced",         desc: "Mix of gold + equities" },
  conservative:  { annual: 0.035, label: "Conservative",     desc: "Low-volatility trade" },
};

/** Frequency bonus (better rates for more frequent deposits) */
export const FREQ_BONUS: Record<Frequency, number> = {
  daily:   0.005,
  weekly:  0.002,
  monthly: 0,
};

const ANNUAL_CAP = 0.06;

export function getEstReturn(strategy: Strategy, frequency: Frequency): number {
  const base = STRATEGY_RETURNS[strategy]?.annual ?? 0.04;
  const bonus = FREQ_BONUS[frequency] ?? 0;
  return Math.min(ANNUAL_CAP, base + bonus);
}

/** Simple compound on a lump sum: P*(1+r)^t */
export function calcCompoundProfit(principal: number, annualRate: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  const fv = principal * Math.pow(1 + annualRate, years);
  return Math.max(0, fv - principal);
}

/**
 * Future value of a DPS (recurring deposit) — annuity-due style.
 * Returns { totalDeposited, profit, totalValue }.
 */
export function calcDpsEstimate(params: {
  amount: number;
  frequency: Frequency;
  totalInstallments: number;
  strategy: Strategy;
}): { totalDeposited: number; profit: number; totalValue: number; annualRate: number } {
  const { amount, frequency, totalInstallments, strategy } = params;
  const periodsPerYear = frequency === "daily" ? 365 : frequency === "weekly" ? 52 : 12;
  const annualRate = getEstReturn(strategy, frequency);
  const r = annualRate / periodsPerYear;
  const n = Math.max(0, Math.floor(totalInstallments));
  const totalDeposited = amount * n;

  let totalValue = totalDeposited;
  if (r > 0 && n > 0) {
    // FV of ordinary annuity: A * ((1+r)^n - 1)/r
    totalValue = amount * ((Math.pow(1 + r, n) - 1) / r);
  }
  const profit = Math.max(0, totalValue - totalDeposited);
  return {
    totalDeposited: Math.round(totalDeposited),
    profit: Math.round(profit),
    totalValue: Math.round(totalValue),
    annualRate,
  };
}

/** Days remaining on a 60-day goal lock */
export function goalLockDaysLeft(createdAt: string): number {
  const lockEnd = new Date(createdAt).getTime() + 60 * 86400_000;
  return Math.max(0, Math.ceil((lockEnd - Date.now()) / 86400_000));
}

/** Days remaining on a 90-day DPS lock */
export function dpsLockDaysLeft(createdAt: string): number {
  const lockEnd = new Date(createdAt).getTime() + 90 * 86400_000;
  return Math.max(0, Math.ceil((lockEnd - Date.now()) / 86400_000));
}

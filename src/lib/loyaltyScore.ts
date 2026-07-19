/**
 * EasyPay Club — combined score weights.
 * Kept in sync with the `recalculate_user_loyalty` Postgres function.
 *
 *   score = volume_30d      * W.volume_30d
 *         + lifetime_txn_count * W.txn_count
 *         + wallet_balance   * W.wallet
 *         + addmoney_lifetime * W.addmoney
 *         + savings_balance  * W.savings
 */
export const LOYALTY_SCORE_WEIGHTS = {
  volume_30d: 0.001,
  txn_count: 2,
  wallet: 0.002,
  addmoney: 0.0005,
  savings: 0.003,
} as const;

export interface LoyaltyMetrics {
  volume_30d?: number | null;
  lifetime_txn_count?: number | null;
  wallet_balance?: number | null;
  addmoney_lifetime?: number | null;
  savings_balance?: number | null;
}

export interface ScoreContribution {
  key: keyof typeof LOYALTY_SCORE_WEIGHTS;
  label: string;
  metric: number;
  weight: number;
  points: number;
  pctOfScore: number;
}

/** Break the combined score down per metric so users can see which lever moves it the most. */
export function computeScoreBreakdown(m: LoyaltyMetrics): {
  total: number;
  parts: ScoreContribution[];
} {
  const rows: Array<Omit<ScoreContribution, "pctOfScore">> = [
    { key: "volume_30d", label: "30-day volume",         metric: Number(m.volume_30d ?? 0),         weight: LOYALTY_SCORE_WEIGHTS.volume_30d, points: 0 },
    { key: "txn_count",  label: "Lifetime transactions", metric: Number(m.lifetime_txn_count ?? 0), weight: LOYALTY_SCORE_WEIGHTS.txn_count,  points: 0 },
    { key: "wallet",     label: "Wallet balance",        metric: Number(m.wallet_balance ?? 0),     weight: LOYALTY_SCORE_WEIGHTS.wallet,     points: 0 },
    { key: "addmoney",   label: "Add-money lifetime",    metric: Number(m.addmoney_lifetime ?? 0),  weight: LOYALTY_SCORE_WEIGHTS.addmoney,   points: 0 },
    { key: "savings",    label: "Savings balance",       metric: Number(m.savings_balance ?? 0),    weight: LOYALTY_SCORE_WEIGHTS.savings,    points: 0 },
  ];
  const parts = rows.map((r) => ({ ...r, points: r.metric * r.weight }));
  const total = parts.reduce((s, p) => s + p.points, 0);
  return {
    total,
    parts: parts.map((p) => ({ ...p, pctOfScore: total > 0 ? (p.points / total) * 100 : 0 })),
  };
}

/**
 * Reference implementation of the server-side transaction limit engine
 * (`resolve_txn_limit_internal` → `enforce_txn_limit` / `get_txn_limit_status`).
 *
 * The SQL functions are the source of truth at runtime; this module mirrors their
 * semantics exactly so the count/amount cap behaviour — day & month window
 * boundaries and EasyPay Club tier resolution — can be exercised in tests.
 */

export type Period = "daily" | "monthly";

export interface TxnRow {
  amount: number;
  status: string;
  created_at: string | Date;
}

export interface TierLimitRow {
  tier_id: string;
  txn_type: string;
  period: Period;
  max_amount: number;
  max_count: number;
}

export interface UserOverrideRow {
  txn_type: string;
  period: Period;
  max_amount: number;
  max_count: number | null;
  is_active: boolean;
  expires_at?: string | Date | null;
}

export interface Tier {
  id: string;
  code: string;
  rank: number;
  limit_multiplier?: number;
}

export interface LoyaltyState {
  current_tier_id?: string | null;
  override_tier_id?: string | null;
  override_until?: string | Date | null;
}

export interface PlatformDefaultRow {
  txn_type: string;
  period: Period;
  max_amount: number;
  max_count: number;
  is_active?: boolean;
}

export interface ResolvedLimit {
  maxAmount: number;
  maxCount: number;
  source: "user_override" | "tier_limit" | "platform_default";
  tierCode: string | null;
}

export interface LimitInput {
  txnType: string;
  now: Date;
  transactions: TxnRow[];
  tiers: Tier[];
  loyalty?: LoyaltyState | null;
  tierLimits?: TierLimitRow[];
  overrides?: UserOverrideRow[];
  platformDefaults?: PlatformDefaultRow[];
}

/** `date_trunc('day' | 'month', now())` — inclusive start of the usage window. */
export function windowStart(now: Date, period: Period): Date {
  const d = new Date(now.getTime());
  d.setHours(0, 0, 0, 0);
  if (period === "monthly") d.setDate(1);
  return d;
}

/** Usage counted by the SQL functions: completed rows of this type inside the window. */
export function usage(transactions: TxnRow[], now: Date, period: Period) {
  const start = windowStart(now, period).getTime();
  const rows = transactions.filter(
    (t) => t.status === "completed" && new Date(t.created_at).getTime() >= start,
  );
  return {
    usedAmount: rows.reduce((s, t) => s + Number(t.amount), 0),
    usedCount: rows.length,
  };
}

/** Which tier applies right now: an unexpired admin override wins over the earned tier. */
export function activeTier(input: LimitInput): Tier | null {
  const { tiers, loyalty, now } = input;
  const overrideActive =
    !!loyalty?.override_tier_id &&
    (!loyalty.override_until || new Date(loyalty.override_until).getTime() > now.getTime());
  const tierId = overrideActive ? loyalty!.override_tier_id : loyalty?.current_tier_id;
  const byId = tierId ? tiers.find((t) => t.id === tierId) : undefined;
  if (byId) return byId;
  // Fallback in SQL: lowest-rank active tier.
  return tiers.slice().sort((a, b) => a.rank - b.rank)[0] ?? null;
}

/** user_limit_overrides → loyalty_tier_limits → transaction_limits × tier multiplier. */
export function resolveLimit(input: LimitInput, period: Period): ResolvedLimit {
  const { txnType, now } = input;

  const ov = (input.overrides ?? []).find(
    (o) =>
      o.txn_type === txnType &&
      o.period === period &&
      o.is_active &&
      (!o.expires_at || new Date(o.expires_at).getTime() > now.getTime()),
  );
  if (ov) {
    return {
      maxAmount: Number(ov.max_amount),
      maxCount: Number(ov.max_count ?? 0),
      source: "user_override",
      tierCode: null,
    };
  }

  const tier = activeTier(input);
  const tierRow = tier
    ? (input.tierLimits ?? []).find(
        (l) => l.tier_id === tier.id && l.txn_type === txnType && l.period === period,
      )
    : undefined;
  if (tierRow) {
    return {
      maxAmount: Number(tierRow.max_amount),
      maxCount: Number(tierRow.max_count ?? 0),
      source: "tier_limit",
      tierCode: tier!.code,
    };
  }

  const def = (input.platformDefaults ?? []).find(
    (d) => d.txn_type === txnType && d.period === period && d.is_active !== false,
  );
  const mult = Number(tier?.limit_multiplier ?? 1) || 1;
  return {
    maxAmount: Number(def?.max_amount ?? 0) * mult,
    maxCount: Number(def?.max_count ?? 0),
    source: "platform_default",
    tierCode: tier?.code ?? null,
  };
}

export interface PeriodStatus extends ResolvedLimit {
  period: Period;
  usedAmount: number;
  usedCount: number;
  remainingAmount: number | null;
  remainingCount: number | null;
}

/** Mirror of `get_txn_limit_status` for both periods. */
export function limitStatus(input: LimitInput): Record<Period, PeriodStatus> {
  const build = (period: Period): PeriodStatus => {
    const r = resolveLimit(input, period);
    const u = usage(input.transactions, input.now, period);
    return {
      ...r,
      period,
      ...u,
      remainingAmount: r.maxAmount <= 0 ? null : Math.max(r.maxAmount - u.usedAmount, 0),
      remainingCount: r.maxCount <= 0 ? null : Math.max(r.maxCount - u.usedCount, 0),
    };
  };
  return { daily: build("daily"), monthly: build("monthly") };
}

export interface EnforceBreach {
  period: Period;
  kind: "amount" | "count";
  limit: number;
  used: number;
  remaining: number;
  tierCode: string;
}

/**
 * Mirror of `enforce_txn_limit`: returns the first breach (daily checked before
 * monthly, amount before count) or null when the transaction is allowed.
 * A cap of 0 means "unlimited", exactly like the SQL guard.
 */
export function enforceLimit(input: LimitInput, amount: number): EnforceBreach | null {
  for (const period of ["daily", "monthly"] as Period[]) {
    const r = resolveLimit(input, period);
    const u = usage(input.transactions, input.now, period);
    if (r.maxAmount > 0 && u.usedAmount + amount > r.maxAmount) {
      return {
        period,
        kind: "amount",
        limit: r.maxAmount,
        used: u.usedAmount,
        remaining: Math.max(r.maxAmount - u.usedAmount, 0),
        tierCode: r.tierCode ?? "",
      };
    }
    if (r.maxCount > 0 && u.usedCount + 1 > r.maxCount) {
      return {
        period,
        kind: "count",
        limit: r.maxCount,
        used: u.usedCount,
        remaining: Math.max(r.maxCount - u.usedCount, 0),
        tierCode: r.tierCode ?? "",
      };
    }
  }
  return null;
}

/** Serialised breach, matching the `LIMIT_EXCEEDED|…` error the SQL guard raises. */
export function breachError(b: EnforceBreach): string {
  return `LIMIT_EXCEEDED|${b.period}|${b.kind}|${b.limit}|${b.used}|${b.remaining}|${b.tierCode}`;
}

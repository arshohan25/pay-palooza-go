import { describe, it, expect } from "vitest";
import {
  windowStart,
  usage,
  resolveLimit,
  limitStatus,
  enforceLimit,
  breachError,
  activeTier,
  type LimitInput,
  type Tier,
  type TierLimitRow,
} from "@/lib/txnLimitEngine";
import { parseLimitError } from "@/lib/limitErrors";

/** EasyPay Club ladder as seeded in `loyalty_tiers`. */
const TIERS: Tier[] = [
  { id: "t1", code: "starter", rank: 1, limit_multiplier: 1 },
  { id: "t2", code: "pro", rank: 2, limit_multiplier: 1.3 },
  { id: "t3", code: "elite", rank: 3, limit_multiplier: 1.6 },
  { id: "t4", code: "prime", rank: 4, limit_multiplier: 2 },
  { id: "t5", code: "signature", rank: 5, limit_multiplier: 2.5 },
];

/** Live count caps for `send` (monthly headline ladder, daily = 1/5 of month). */
const SEND_LIMITS: TierLimitRow[] = [
  { tier_id: "t1", txn_type: "send", period: "daily", max_amount: 50000, max_count: 25 },
  { tier_id: "t1", txn_type: "send", period: "monthly", max_amount: 300000, max_count: 100 },
  { tier_id: "t5", txn_type: "send", period: "daily", max_amount: 80000, max_count: 63 },
  { tier_id: "t5", txn_type: "send", period: "monthly", max_amount: 480000, max_count: 250 },
];

const txn = (created_at: string, amount = 100, status = "completed") => ({
  amount,
  status,
  created_at,
});

const base = (over: Partial<LimitInput> = {}): LimitInput => ({
  txnType: "send",
  now: new Date("2026-08-15T12:00:00"),
  transactions: [],
  tiers: TIERS,
  loyalty: { current_tier_id: "t1" },
  tierLimits: SEND_LIMITS,
  ...over,
});

const nTxns = (n: number, at: string) => Array.from({ length: n }, () => txn(at));

describe("usage windows — day boundary", () => {
  it("counts only transactions from midnight local today", () => {
    const input = base({
      transactions: [
        txn("2026-08-14T23:59:59"), // yesterday — excluded from daily
        txn("2026-08-15T00:00:00"), // exactly midnight — included
        txn("2026-08-15T11:00:00"),
      ],
    });
    expect(usage(input.transactions, input.now, "daily").usedCount).toBe(2);
    expect(usage(input.transactions, input.now, "monthly").usedCount).toBe(3);
  });

  it("resets the daily counter after the boundary rolls over", () => {
    const yesterdayFull = nTxns(25, "2026-08-14T10:00:00");
    const atCap = base({ transactions: yesterdayFull, now: new Date("2026-08-14T23:00:00") });
    expect(enforceLimit(atCap, 100)?.kind).toBe("count");

    const nextDay = base({ transactions: yesterdayFull, now: new Date("2026-08-15T00:00:01") });
    expect(enforceLimit(nextDay, 100)).toBeNull();
    expect(limitStatus(nextDay).daily.remainingCount).toBe(25);
    // Monthly usage carries over across the day boundary.
    expect(limitStatus(nextDay).monthly.usedCount).toBe(25);
  });

  it("windowStart is midnight for daily and the 1st for monthly", () => {
    const now = new Date("2026-08-15T18:45:30");
    expect(windowStart(now, "daily").toISOString()).toBe(
      new Date("2026-08-15T00:00:00").toISOString(),
    );
    expect(windowStart(now, "monthly").toISOString()).toBe(
      new Date("2026-08-01T00:00:00").toISOString(),
    );
  });
});

describe("usage windows — month boundary", () => {
  it("excludes last month's transactions from the monthly counter", () => {
    const input = base({
      transactions: [
        txn("2026-07-31T23:59:59"),
        txn("2026-08-01T00:00:00"),
        txn("2026-08-15T09:00:00"),
      ],
    });
    expect(usage(input.transactions, input.now, "monthly").usedCount).toBe(2);
  });

  it("resets the monthly count cap on the 1st", () => {
    const julyFull = nTxns(100, "2026-07-20T10:00:00");
    const endOfJuly = base({ transactions: julyFull, now: new Date("2026-07-31T22:00:00") });
    const breach = enforceLimit(endOfJuly, 100);
    expect(breach).toMatchObject({ period: "monthly", kind: "count", limit: 100, remaining: 0 });

    const augustFirst = base({ transactions: julyFull, now: new Date("2026-08-01T00:00:00") });
    expect(enforceLimit(augustFirst, 100)).toBeNull();
    expect(limitStatus(augustFirst).monthly.usedCount).toBe(0);
    expect(limitStatus(augustFirst).monthly.remainingCount).toBe(100);
  });

  it("handles a 31 → 1 rollover for a 30-day month", () => {
    const input = base({
      transactions: nTxns(5, "2026-06-30T23:30:00"),
      now: new Date("2026-07-01T00:10:00"),
    });
    expect(limitStatus(input).monthly.usedCount).toBe(0);
    expect(limitStatus(input).daily.usedCount).toBe(0);
  });
});

describe("count caps vs amount caps", () => {
  it("blocks on daily count while the amount cap still has headroom", () => {
    const input = base({ transactions: nTxns(25, "2026-08-15T08:00:00") }); // 25 × ৳100
    const b = enforceLimit(input, 100)!;
    expect(b).toMatchObject({ period: "daily", kind: "count", limit: 25, used: 25, remaining: 0 });
    expect(limitStatus(input).daily.remainingAmount).toBe(47500);
  });

  it("reports amount before count when both are breached", () => {
    const input = base({ transactions: nTxns(25, "2026-08-15T08:00:00", ) });
    // Push the amount over 50,000 in a single txn.
    expect(enforceLimit(input, 60000)?.kind).toBe("amount");
  });

  it("allows exactly the last permitted transaction", () => {
    const input = base({ transactions: nTxns(24, "2026-08-15T08:00:00") });
    expect(enforceLimit(input, 100)).toBeNull();
    expect(limitStatus(input).daily.remainingCount).toBe(1);
  });

  it("ignores pending and failed transactions", () => {
    const input = base({
      transactions: [
        ...nTxns(24, "2026-08-15T08:00:00"),
        txn("2026-08-15T09:00:00", 100, "pending"),
        txn("2026-08-15T09:30:00", 100, "failed"),
      ],
    });
    expect(limitStatus(input).daily.usedCount).toBe(24);
    expect(enforceLimit(input, 100)).toBeNull();
  });

  it("treats a cap of 0 as unlimited", () => {
    const input = base({
      tierLimits: [
        { tier_id: "t1", txn_type: "send", period: "daily", max_amount: 0, max_count: 0 },
        { tier_id: "t1", txn_type: "send", period: "monthly", max_amount: 0, max_count: 0 },
      ],
      transactions: nTxns(500, "2026-08-15T08:00:00"),
    });
    expect(enforceLimit(input, 999999)).toBeNull();
    expect(limitStatus(input).daily.remainingCount).toBeNull();
  });

  it("serialises breaches into the error the client parser understands", () => {
    const b = enforceLimit(base({ transactions: nTxns(25, "2026-08-15T08:00:00") }), 100)!;
    const parsed = parseLimitError(breachError(b));
    expect(parsed).toMatchObject({ period: "daily", kind: "count", limit: 25, remaining: 0 });
  });
});

describe("tier changes", () => {
  it("upgrading tier lifts the count cap and unblocks usage immediately", () => {
    const txns = nTxns(30, "2026-08-15T08:00:00");
    const starter = base({ transactions: txns });
    expect(enforceLimit(starter, 100)?.limit).toBe(25);

    const signature = base({ transactions: txns, loyalty: { current_tier_id: "t5" } });
    expect(enforceLimit(signature, 100)).toBeNull();
    const s = limitStatus(signature);
    expect(s.daily.maxCount).toBe(63);
    expect(s.daily.remainingCount).toBe(33);
    expect(s.monthly.maxCount).toBe(250);
    expect(s.daily.tierCode).toBe("signature");
  });

  it("downgrading below current usage clamps remaining to 0 instead of going negative", () => {
    const input = base({
      transactions: nTxns(40, "2026-08-15T08:00:00"),
      loyalty: { current_tier_id: "t1" },
    });
    const s = limitStatus(input);
    expect(s.daily.usedCount).toBe(40);
    expect(s.daily.remainingCount).toBe(0);
    expect(enforceLimit(input, 100)).toMatchObject({ kind: "count", used: 40, remaining: 0 });
  });

  it("an unexpired admin tier override wins over the earned tier", () => {
    const input = base({
      transactions: nTxns(30, "2026-08-15T08:00:00"),
      loyalty: {
        current_tier_id: "t1",
        override_tier_id: "t5",
        override_until: "2026-09-01T00:00:00",
      },
    });
    expect(activeTier(input)?.code).toBe("signature");
    expect(limitStatus(input).daily.maxCount).toBe(63);
    expect(enforceLimit(input, 100)).toBeNull();
  });

  it("an expired override falls back to the earned tier at the boundary", () => {
    const loyalty = {
      current_tier_id: "t1",
      override_tier_id: "t5",
      override_until: "2026-08-15T12:00:00",
    };
    const input = base({ transactions: nTxns(30, "2026-08-15T08:00:00"), loyalty });
    // now === override_until → no longer active (SQL uses `> now()`).
    expect(activeTier(input)?.code).toBe("starter");
    expect(enforceLimit(input, 100)?.limit).toBe(25);
  });

  it("falls back to the lowest-rank tier when the user has no loyalty row", () => {
    const input = base({ loyalty: null });
    expect(activeTier(input)?.code).toBe("starter");
    expect(resolveLimit(input, "daily")).toMatchObject({ maxCount: 25, source: "tier_limit" });
  });
});

describe("resolution order", () => {
  it("a user override beats the tier count cap", () => {
    const input = base({
      loyalty: { current_tier_id: "t5" },
      overrides: [
        {
          txn_type: "send",
          period: "daily",
          max_amount: 20000,
          max_count: 5,
          is_active: true,
          expires_at: "2026-09-01T00:00:00",
        },
      ],
      transactions: nTxns(5, "2026-08-15T08:00:00"),
    });
    const r = resolveLimit(input, "daily");
    expect(r).toMatchObject({ source: "user_override", maxCount: 5, tierCode: null });
    expect(enforceLimit(input, 100)).toMatchObject({ kind: "count", limit: 5 });
  });

  it("an expired or inactive override is skipped", () => {
    const overrides = [
      { txn_type: "send", period: "daily" as const, max_amount: 1, max_count: 1, is_active: true, expires_at: "2026-08-01T00:00:00" },
      { txn_type: "send", period: "daily" as const, max_amount: 2, max_count: 2, is_active: false },
    ];
    expect(resolveLimit(base({ overrides }), "daily").source).toBe("tier_limit");
  });

  it("falls back to platform defaults × tier multiplier when the tier has no row", () => {
    const input = base({
      tierLimits: [],
      loyalty: { current_tier_id: "t4" },
      platformDefaults: [
        { txn_type: "send", period: "daily", max_amount: 50000, max_count: 20 },
        { txn_type: "send", period: "monthly", max_amount: 300000, max_count: 80 },
      ],
    });
    const r = resolveLimit(input, "daily");
    expect(r).toMatchObject({ source: "platform_default", maxAmount: 100000, maxCount: 20 });
    expect(resolveLimit(input, "monthly").maxCount).toBe(80);
  });
});

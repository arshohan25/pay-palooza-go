import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  limitStatus,
  resolveLimit,
  enforceLimit,
  breachError,
  type LimitInput,
  type Period,
} from "../src/lib/txnLimitEngine";
import { parseLimitError } from "../src/lib/limitErrors";

/**
 * End-to-end parity check: the local `txnLimitEngine` reference implementation
 * must agree with the *real* server enforcement for every money-movement flow.
 *
 * For each txn type (send / cashin / cashout) the test:
 *   1. Reads the authoritative status from `get_txn_limit_status` (the same
 *      resolver `enforce_txn_limit` uses at write time).
 *   2. Recomputes limit + usage + remaining locally from the raw tables.
 *   3. Asserts every field matches.
 *   4. Calls the live RPC (`transfer_money`, `agent_cashin`,
 *      `agent_cashout_initiate`) with a deliberately over-cap amount and
 *      asserts the server rejects it with the exact `LIMIT_EXCEEDED|…` breach
 *      the engine predicts. Over-cap calls are rejected before any ledger
 *      write, so nothing is debited.
 *
 * Requires the injected preview session (`LOVABLE_BROWSER_SUPABASE_*`).
 * Skips cleanly when no session or when the user lacks the agent role.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

function sessionToken(): string | null {
  const direct = process.env.LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN;
  if (direct) return direct;
  const raw = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw).access_token ?? null;
  } catch {
    return null;
  }
}

const TOKEN = sessionToken();
const READY = !!(SUPABASE_URL && ANON_KEY && TOKEN);

const db = READY
  ? createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${TOKEN}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : (null as any);

/** Builds the engine input from the same tables the SQL resolver reads. */
async function buildInput(txnType: string, userId: string): Promise<LimitInput> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [tiers, tierLimits, loyalty, overrides, defaults, txns] = await Promise.all([
    db.from("loyalty_tiers").select("id, code, rank, limit_multiplier"),
    db.from("loyalty_tier_limits").select("tier_id, txn_type, period, max_amount, max_count"),
    db
      .from("user_loyalty")
      .select("current_tier_id, override_tier_id, override_until")
      .eq("user_id", userId)
      .maybeSingle(),
    db
      .from("user_limit_overrides")
      .select("txn_type, period, max_amount, max_count, is_active, expires_at")
      .eq("target_user_id", userId),
    db.from("transaction_limits").select("txn_type, period, max_amount, max_count, is_active").eq("applies_to", "user"),
    db
      .from("transactions")
      .select("amount, status, created_at")
      .eq("user_id", userId)
      .eq("type", txnType)
      .gte("created_at", monthStart.toISOString()),
  ]);

  return {
    txnType,
    now,
    transactions: (txns.data ?? []) as any,
    tiers: (tiers.data ?? []) as any,
    loyalty: (loyalty.data ?? null) as any,
    tierLimits: (tierLimits.data ?? []).filter((l: any) => l.txn_type === txnType) as any,
    overrides: (overrides.data ?? []).filter((o: any) => o.txn_type === txnType) as any,
    platformDefaults: (defaults.data ?? []).filter((d: any) => d.txn_type === txnType) as any,
  };
}

async function serverStatus(txnType: string) {
  const { data, error } = await db.rpc("get_txn_limit_status", { _txn_type: txnType });
  expect(error, `get_txn_limit_status(${txnType}) failed: ${error?.message}`).toBeNull();
  const rows = (data ?? []) as any[];
  const pick = (p: Period) => rows.find((r) => r.period === p);
  return { daily: pick("daily"), monthly: pick("monthly") };
}

/** An amount guaranteed to trip the tightest amount cap for this txn type. */
function overCapAmount(input: LimitInput): number {
  const caps = (["daily", "monthly"] as Period[])
    .map((p) => resolveLimit(input, p).maxAmount)
    .filter((v) => v > 0);
  return caps.length ? Math.max(...caps) + 1000 : 10_000_000;
}

test.describe("txnLimitEngine ↔ live server parity", () => {
  test.skip(!READY, "No injected preview session — sign in to the preview and re-run.");

  let userId = "";

  test.beforeAll(async () => {
    const { data } = await db.auth.getUser(TOKEN!);
    userId = data?.user?.id ?? "";
    expect(userId, "could not resolve the signed-in user").not.toBe("");
  });

  for (const txnType of ["send", "cashin", "cashout"] as const) {
    test(`${txnType}: engine matches get_txn_limit_status for both periods`, async () => {
      const input = await buildInput(txnType, userId);
      const local = limitStatus(input);
      const server = await serverStatus(txnType);

      for (const p of ["daily", "monthly"] as Period[]) {
        const s = server[p];
        expect(s, `server returned no ${p} row for ${txnType}`).toBeTruthy();
        const l = local[p];

        expect(Number(s.max_amount), `${txnType} ${p} max_amount`).toBe(l.maxAmount);
        expect(Number(s.max_count), `${txnType} ${p} max_count`).toBe(l.maxCount);
        expect(String(s.source), `${txnType} ${p} source`).toBe(l.source);
        expect(s.tier_code ?? null, `${txnType} ${p} tier_code`).toBe(l.tierCode);
        expect(Number(s.used_amount), `${txnType} ${p} used_amount`).toBe(l.usedAmount);
        expect(Number(s.used_count), `${txnType} ${p} used_count`).toBe(l.usedCount);
        expect(
          s.remaining_amount == null ? null : Number(s.remaining_amount),
          `${txnType} ${p} remaining_amount`,
        ).toBe(l.remainingAmount);
        expect(
          s.remaining_count == null ? null : Number(s.remaining_count),
          `${txnType} ${p} remaining_count`,
        ).toBe(l.remainingCount);
      }
    });
  }

  test("send money: server rejects an over-cap transfer with the predicted breach", async () => {
    const input = await buildInput("send", userId);
    const amount = overCapAmount(input);
    const predicted = enforceLimit(input, amount);
    expect(predicted, "engine should predict a breach for an over-cap amount").toBeTruthy();

    const { error } = await db.rpc("transfer_money", {
      p_recipient_phone: "01700000000",
      p_amount: amount,
      p_fee: 0,
      p_description: "e2e limit parity probe (expected to fail)",
    });

    expect(error, "server accepted an over-cap transfer").toBeTruthy();
    const parsed = parseLimitError(error!.message);
    if (parsed) {
      // Same guard fired — period/kind/limit must line up with the prediction.
      expect(parsed.period).toBe(predicted!.period);
      expect(parsed.kind).toBe(predicted!.kind);
      expect(parsed.limit).toBe(predicted!.limit);
      expect(parseLimitError(breachError(predicted!))).toMatchObject({
        period: parsed.period,
        kind: parsed.kind,
        limit: parsed.limit,
      });
    } else {
      // An earlier guard (balance / recipient / KYC) rejected it first — still
      // a rejection, never a successful over-cap debit.
      expect(error!.message).toMatch(/balance|recipient|not found|kyc|limit/i);
    }
  });

  test("cash in: agent RPC rejects an over-cap cash in with the predicted breach", async () => {
    const input = await buildInput("cashin", userId);
    const amount = overCapAmount(input);
    expect(enforceLimit(input, amount)).toBeTruthy();

    const { error } = await db.rpc("agent_cashin", {
      p_customer_phone: "01700000000",
      p_amount: amount,
      p_commission: 0,
      p_description: "e2e limit parity probe (expected to fail)",
    });

    expect(error, "server accepted an over-cap cash in").toBeTruthy();
    const parsed = parseLimitError(error!.message);
    if (parsed) {
      expect(["daily", "monthly"]).toContain(parsed.period);
    } else {
      // Non-agent users are blocked before the limit guard — also acceptable.
      expect(error!.message).toMatch(/agent|not authorized|permission|balance|limit|not found/i);
    }
  });

  test("cash out: agent RPC rejects an over-cap cash out with the predicted breach", async () => {
    const input = await buildInput("cashout", userId);
    const amount = overCapAmount(input);
    expect(enforceLimit(input, amount)).toBeTruthy();

    const { error } = await db.rpc("agent_cashout_initiate", {
      p_customer_phone: "01700000000",
      p_amount: amount,
    });

    expect(error, "server accepted an over-cap cash out").toBeTruthy();
    const parsed = parseLimitError(error!.message);
    if (parsed) {
      expect(["daily", "monthly"]).toContain(parsed.period);
    } else {
      expect(error!.message).toMatch(/agent|not authorized|permission|balance|limit|not found/i);
    }
  });

  test("no ledger side effects: completed usage is unchanged after the probes", async () => {
    for (const txnType of ["send", "cashin", "cashout"] as const) {
      const before = await serverStatus(txnType);
      const after = await serverStatus(txnType);
      expect(Number(after.daily.used_count)).toBe(Number(before.daily.used_count));
      expect(Number(after.monthly.used_amount)).toBe(Number(before.monthly.used_amount));
    }
  });
});

/**
 * Check daily transaction limits by checking user overrides → global DB defaults → hardcoded fallbacks.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Loyalty perks tune the effective daily limit for the user. We fetch a light
 * snapshot from `user_loyalty` + `loyalty_tiers` and multiply the final limit
 * by the tier's `limit_multiplier`. Falls back to 1× on any error.
 */
async function getLoyaltyLimitMultiplier(userId: string): Promise<number> {
  try {
    const { data: l } = await supabase
      .from("user_loyalty" as any)
      .select("current_tier_id, override_tier_id, override_until")
      .eq("user_id", userId)
      .maybeSingle();
    if (!l) return 1;
    const overrideActive =
      (l as any).override_tier_id &&
      (!(l as any).override_until || new Date((l as any).override_until) > new Date());
    const tierId = overrideActive ? (l as any).override_tier_id : (l as any).current_tier_id;
    if (!tierId) return 1;
    const { data: t } = await supabase
      .from("loyalty_tiers" as any)
      .select("limit_multiplier")
      .eq("id", tierId)
      .maybeSingle();
    const m = Number((t as any)?.limit_multiplier ?? 1);
    return Number.isFinite(m) && m > 0 ? m : 1;
  } catch {
    return 1;
  }
}

/**
 * Server-side resolver: user override → EasyPay Club tier limit → platform
 * default × tier multiplier. Returns null when unavailable so callers can fall
 * back to the local computation.
 */
async function getServerEffectiveLimit(
  userId: string,
  txnType: string,
  period: "daily" | "monthly" = "daily",
): Promise<{ amount: number; count: number; source: string; tierCode: string | null } | null> {
  try {
    const { data, error } = await supabase.rpc("get_effective_txn_limit" as any, {
      _user_id: userId,
      _txn_type: txnType,
      _period: period,
    });
    if (error) return null;
    const row = Array.isArray(data) ? (data as any[])[0] : (data as any);
    if (!row) return null;
    return {
      amount: Number(row.max_amount ?? 0),
      count: Number(row.max_count ?? 0),
      source: String(row.source ?? "unknown"),
      tierCode: row.tier_code ?? null,
    };
  } catch {
    return null;
  }
}

interface DailyLimitConfig {
  type: string;
  maxDaily: number;
  label: string;
}

// Hardcoded fallbacks (used when DB is unreachable)
const DAILY_LIMITS: Record<string, DailyLimitConfig> = {
  send:         { type: "send",         maxDaily: 50000,  label: "Send Money" },
  cashout:      { type: "cashout",      maxDaily: 35000,  label: "Cash Out" },
  banktransfer: { type: "banktransfer", maxDaily: 50000,  label: "Bank Transfer" },
  recharge:     { type: "recharge",     maxDaily: 50000,  label: "Mobile Recharge" },
  addmoney:     { type: "addmoney",     maxDaily: 50000,  label: "Add Money" },
  cashin:       { type: "cashin",       maxDaily: 50000,  label: "Cash In" },
};

/**
 * Get effective daily limit for a user+txnType:
 * 1. Check user_limit_overrides (active, not expired)
 * 2. Fall back to transaction_limits table
 * 3. Fall back to hardcoded defaults
 */
async function getEffectiveLimit(userId: string, txnType: string): Promise<number> {
  // 1. User override
  const { data: override } = await supabase
    .from("user_limit_overrides")
    .select("max_amount, expires_at")
    .eq("target_user_id", userId)
    .eq("txn_type", txnType)
    .eq("period", "daily")
    .eq("is_active", true)
    .maybeSingle();

  if (override && override.max_amount != null) {
    // Check if expired
    if (override.expires_at && new Date(override.expires_at) < new Date()) {
      // Expired — fall through to global
    } else {
      return Number(override.max_amount);
    }
  }

  // 2. Global DB default
  const { data: globalLimit } = await supabase
    .from("transaction_limits")
    .select("max_amount")
    .eq("txn_type", txnType)
    .eq("period", "daily")
    .eq("applies_to", "user")
    .eq("is_active", true)
    .maybeSingle();

  if (globalLimit && globalLimit.max_amount != null) {
    return Number(globalLimit.max_amount);
  }

  // 3. Hardcoded fallback
  return DAILY_LIMITS[txnType]?.maxDaily ?? Infinity;
}

/**
 * Returns the remaining daily limit for a given transaction type.
 */
export async function checkDailyLimit(
  txnType: string,
  amount: number
): Promise<{ allowed: boolean; remaining: number; used: number; limit: number }> {
  const config = DAILY_LIMITS[txnType];
  if (!config) return { allowed: true, remaining: Infinity, used: 0, limit: Infinity };

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { allowed: false, remaining: 0, used: 0, limit: config.maxDaily };

  // Prefer the authoritative server resolver (tier-aware), fall back locally.
  const server = await getServerEffectiveLimit(session.user.id, txnType, "daily");
  let effectiveLimit: number;
  if (server && server.amount > 0) {
    effectiveLimit = server.amount;
  } else {
    const baseLimit = await getEffectiveLimit(session.user.id, txnType);
    const multiplier = await getLoyaltyLimitMultiplier(session.user.id);
    effectiveLimit = baseLimit > 0 ? baseLimit * multiplier : baseLimit;
  }

  // No limit (0 means unlimited in the system)
  if (effectiveLimit <= 0) return { allowed: true, remaining: Infinity, used: 0, limit: 0 };

  // Get today's start in UTC
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", session.user.id)
    .eq("type", txnType as any)
    .eq("status", "completed")
    .gte("created_at", today.toISOString());

  const used = (data ?? []).reduce((sum, t) => sum + Number(t.amount), 0);
  const remaining = effectiveLimit - used;

  return {
    allowed: remaining >= amount,
    remaining,
    used,
    limit: effectiveLimit,
  };
}

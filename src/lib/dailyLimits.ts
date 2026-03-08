/**
 * Check daily transaction limits by checking user overrides → global DB defaults → hardcoded fallbacks.
 */
import { supabase } from "@/integrations/supabase/client";

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

  const effectiveLimit = await getEffectiveLimit(session.user.id, txnType);

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

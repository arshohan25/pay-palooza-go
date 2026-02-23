/**
 * Check daily transaction limits by summing today's completed transactions.
 */
import { supabase } from "@/integrations/supabase/client";

interface DailyLimitConfig {
  type: string;
  maxDaily: number;
  label: string;
}

const DAILY_LIMITS: Record<string, DailyLimitConfig> = {
  send:         { type: "send",         maxDaily: 50000,  label: "Send Money" },
  cashout:      { type: "cashout",      maxDaily: 50000,  label: "Cash Out" },
  banktransfer: { type: "banktransfer", maxDaily: 50000,  label: "Bank Transfer" },
  payment:      { type: "payment",      maxDaily: 100000, label: "Payment" },
  recharge:     { type: "recharge",     maxDaily: 10000,  label: "Mobile Recharge" },
  paybill:      { type: "paybill",      maxDaily: 50000,  label: "Bill Pay" },
  addmoney:     { type: "addmoney",     maxDaily: 100000, label: "Add Money" },
};

/**
 * Returns the remaining daily limit for a given transaction type.
 * Returns { allowed: true, remaining } or { allowed: false, used, limit }.
 */
export async function checkDailyLimit(
  txnType: string,
  amount: number
): Promise<{ allowed: boolean; remaining: number; used: number; limit: number }> {
  const config = DAILY_LIMITS[txnType];
  if (!config) return { allowed: true, remaining: Infinity, used: 0, limit: Infinity };

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { allowed: false, remaining: 0, used: 0, limit: config.maxDaily };

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
  const remaining = config.maxDaily - used;

  return {
    allowed: remaining >= amount,
    remaining,
    used,
    limit: config.maxDaily,
  };
}

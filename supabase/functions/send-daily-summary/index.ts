// Monthly spend/income summary push — runs on the 1st of each month (BDT).
// Safe to invoke daily via cron: it no-ops on non-first days.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEBIT_TYPES = new Set(["send_money", "cash_out", "payment", "mobile_recharge", "pay_bill", "shop_purchase", "donation"]);
const CREDIT_TYPES = new Set(["receive_money", "cash_in", "add_money", "refund", "commission"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // "Now" in BDT (UTC+6)
    const now = new Date();
    const bdtNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    // Only fire on the 1st of the month (BDT) unless forced
    if (!force && bdtNow.getUTCDate() !== 1) {
      return new Response(JSON.stringify({ skipped: "not first of month" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Previous month range in BDT
    const prevMonthEndBdt = new Date(Date.UTC(bdtNow.getUTCFullYear(), bdtNow.getUTCMonth(), 1, 0, 0, 0));
    const prevMonthStartBdt = new Date(Date.UTC(bdtNow.getUTCFullYear(), bdtNow.getUTCMonth() - 1, 1, 0, 0, 0));
    // Convert BDT instants to UTC
    const startUtc = new Date(prevMonthStartBdt.getTime() - 6 * 60 * 60 * 1000);
    const endUtc = new Date(prevMonthEndBdt.getTime() - 6 * 60 * 60 * 1000);

    const monthLabel = prevMonthStartBdt.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    const monthKey = `${prevMonthStartBdt.getUTCFullYear()}-${String(prevMonthStartBdt.getUTCMonth() + 1).padStart(2, "0")}`;

    // Pull last month's completed transactions
    const { data: txns, error } = await supabase
      .from("transactions")
      .select("user_id, type, amount, status")
      .eq("status", "completed")
      .gte("created_at", startUtc.toISOString())
      .lt("created_at", endUtc.toISOString());

    if (error) throw error;

    // Aggregate per user
    const byUser = new Map<string, { spent: number; received: number; count: number }>();
    for (const t of txns ?? []) {
      const cur = byUser.get(t.user_id) ?? { spent: 0, received: 0, count: 0 };
      const amt = Number(t.amount ?? 0);
      if (DEBIT_TYPES.has(t.type)) cur.spent += amt;
      else if (CREDIT_TYPES.has(t.type)) cur.received += amt;
      cur.count += 1;
      byUser.set(t.user_id, cur);
    }

    if (byUser.size === 0) {
      return new Response(JSON.stringify({ summary: 0, pushed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = Array.from(byUser.keys());

    // De-dup: skip users who already got this month's summary
    const { data: alreadySent } = await supabase
      .from("notifications")
      .select("user_id, metadata")
      .eq("category", "monthly_summary")
      .in("user_id", userIds);
    const skip = new Set(
      (alreadySent ?? [])
        .filter((n: any) => n?.metadata?.month === monthKey)
        .map((n: any) => n.user_id)
    );

    const fmt = (n: number) => Math.round(n).toLocaleString("en-BD");
    let pushed = 0;
    const pushTargets: string[] = [];
    const inserts: any[] = [];

    const title = `📊 ${monthLabel} summary`;

    for (const [uid, agg] of byUser.entries()) {
      if (skip.has(uid)) continue;
      const parts: string[] = [];
      if (agg.received > 0) parts.push(`In ৳${fmt(agg.received)}`);
      if (agg.spent > 0) parts.push(`Out ৳${fmt(agg.spent)}`);
      const body = parts.length ? parts.join(" · ") + ` · ${agg.count} txn${agg.count === 1 ? "" : "s"}` : `${agg.count} transaction${agg.count === 1 ? "" : "s"}`;

      inserts.push({
        user_id: uid,
        title,
        body,
        category: "monthly_summary",
        metadata: { spent: agg.spent, received: agg.received, count: agg.count, month: monthKey },
      });
      pushTargets.push(uid);
    }

    if (inserts.length > 0) {
      await supabase.from("notifications").insert(inserts);
    }

    if (pushTargets.length > 0) {
      try {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            user_ids: pushTargets,
            title,
            body: "Tap to see your monthly spending recap",
            url: "/spending-insights",
          },
        });
        pushed = pushTargets.length;
      } catch (_) { /* swallow */ }
    }

    return new Response(JSON.stringify({ summary: byUser.size, pushed, inserted: inserts.length, month: monthKey }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

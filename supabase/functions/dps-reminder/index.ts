import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find all active schedules where next_run_at is within the next 24 hours
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: schedules, error: fetchErr } = await supabase
      .from("savings_auto_save")
      .select("*")
      .eq("is_active", true)
      .eq("settled", false)
      .gte("next_run_at", now.toISOString())
      .lte("next_run_at", in24h.toISOString());

    if (fetchErr) throw fetchErr;

    let sent = 0;

    for (const schedule of schedules ?? []) {
      // Check if we already sent a reminder for this cycle (avoid duplicates)
      const nextRunDate = new Date(schedule.next_run_at).toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", schedule.user_id)
        .eq("category", "savings_reminder")
        .gte("created_at", `${nextRunDate}T00:00:00Z`)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Check user balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("user_id", schedule.user_id)
        .single();

      const currentBalance = profile ? Number(profile.balance) : 0;
      const needsMore = currentBalance < Number(schedule.amount);
      const shortfall = Number(schedule.amount) - currentBalance;

      const runTime = new Date(schedule.next_run_at).toLocaleTimeString("en-BD", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      const title = "DPS Installment Scheduled";
      const body = needsMore
        ? `Your DPS installment of ৳${Number(schedule.amount).toLocaleString()} is due tomorrow. You need ৳${Math.ceil(shortfall).toLocaleString()} more in your wallet. Please top up to avoid missing a payment.`
        : `Your DPS installment of ৳${Number(schedule.amount).toLocaleString()} will be auto-collected tomorrow. Please ensure your wallet has sufficient funds to complete the payment.`;

      await supabase.from("notifications").insert({
        user_id: schedule.user_id,
        title,
        body,
        category: "savings_reminder",
      });

      // Web push (best-effort)
      try {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            user_ids: [schedule.user_id],
            title,
            body,
            url: "/savings",
          },
        });
      } catch (_) { /* swallow */ }

      sent++;
    }

    return new Response(JSON.stringify({ sent, checked: schedules?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

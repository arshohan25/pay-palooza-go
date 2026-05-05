import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = Deno.env.get("ADMIN_METRICS_CRON_SECRET") ?? "";

    // Authorization: cron-secret OR any bearer token (job is idempotent — safe to allow re-triggering)
    const authHeader = req.headers.get("Authorization") ?? "";
    const cronHeader = req.headers.get("x-cron-secret") ?? "";
    const isCron = cronSecret && cronHeader === cronSecret;
    const hasBearer = authHeader.startsWith("Bearer ") && authHeader.length > 20;
    if (!isCron && !hasBearer) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all due auto-saves
    const { data: schedules, error: fetchErr } = await supabase
      .from("savings_auto_save")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_at", new Date().toISOString());

    if (fetchErr) throw fetchErr;

    let processed = 0;
    let skipped = 0;
    let settled = 0;
    let missed = 0;
    let dedup = 0;

    const sendPush = async (user_id: string, title: string, body: string) => {
      try {
        await supabase.functions.invoke("send-push-notification", {
          body: { user_ids: [user_id], title, body, url: "/savings" },
        });
      } catch (_) { /* best-effort */ }
    };

    for (const schedule of schedules ?? []) {
      // ─── Idempotency guard ────────────────────────────
      // If last_run_at is within the cycle window, skip (prevents double-charge on rapid re-invocation)
      if (schedule.last_run_at) {
        const last = new Date(schedule.last_run_at).getTime();
        const minGap = schedule.frequency === "daily" ? 20 * 60 * 60 * 1000 // 20h
          : schedule.frequency === "weekly" ? 6 * 24 * 60 * 60 * 1000      // 6d
          : 27 * 24 * 60 * 60 * 1000;                                       // 27d
        if (Date.now() - last < minGap) {
          dedup++;
          continue;
        }
      }

      // Check if schedule has expired (duration ended)
      if (schedule.ends_at && new Date(schedule.ends_at) <= new Date()) {
        await supabase.from("savings_auto_save").update({
          is_active: false,
          settled: true,
          updated_at: new Date().toISOString(),
        }).eq("id", schedule.id);

        await supabase.from("notifications").insert({
          user_id: schedule.user_id,
          title: "✅ DPS Plan Completed",
          body: `Your ৳${schedule.amount}/${schedule.frequency} DPS plan has completed its ${schedule.duration || ""} duration. Total paid: ${schedule.total_paid ?? 0} installments.`,
          category: "savings",
        });
        await sendPush(schedule.user_id, "✅ DPS Plan Completed", `Your DPS plan has finished. ${schedule.total_paid ?? 0} installments paid.`);

        settled++;
        continue;
      }

      // Find the target goal
      let goalId = schedule.goal_id;

      if (!goalId) {
        const { data: goals } = await supabase
          .from("savings_goals")
          .select("id")
          .eq("user_id", schedule.user_id)
          .eq("status", "active")
          .limit(1);

        if (!goals || goals.length === 0) {
          goalId = null;
        } else {
          goalId = goals[0].id;
        }
      }

      // Check balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("user_id", schedule.user_id)
        .single();

      // Calculate next run regardless of success/failure
      const nextRun = new Date();
      if (schedule.frequency === "daily") nextRun.setDate(nextRun.getDate() + 1);
      else if (schedule.frequency === "weekly") nextRun.setDate(nextRun.getDate() + 7);
      else nextRun.setMonth(nextRun.getMonth() + 1);

      if (!profile || Number(profile.balance) < Number(schedule.amount)) {
        // ═══ MISSED PAYMENT ═══
        await supabase.from("dps_missed_payments").insert({
          schedule_id: schedule.id,
          user_id: schedule.user_id,
          amount: schedule.amount,
          due_date: new Date().toISOString(),
        });

        await supabase.from("savings_auto_save").update({
          missed_count: (schedule.missed_count ?? 0) + 1,
          last_missed_at: new Date().toISOString(),
          next_run_at: nextRun.toISOString(),
          last_run_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", schedule.id);

        const missedTitle = "⚠️ DPS Installment Missed";
        const missedBody = `Insufficient balance for ৳${schedule.amount} DPS installment. You can repay later from Savings > Active Plans.`;
        await supabase.from("notifications").insert({
          user_id: schedule.user_id,
          title: missedTitle,
          body: missedBody,
          category: "savings",
        });
        await sendPush(schedule.user_id, missedTitle, missedBody);

        missed++;
        continue;
      }

      // ═══ SUCCESSFUL PAYMENT ═══
      if (!goalId) {
        skipped++;
        continue;
      }

      const { data: goal } = await supabase
        .from("savings_goals")
        .select("*")
        .eq("id", goalId)
        .single();

      if (!goal || goal.status !== "active") {
        skipped++;
        continue;
      }

      const newBalance = Number(profile.balance) - Number(schedule.amount);
      const newSaved = Number(goal.saved_amount) + Number(schedule.amount);
      const completed = newSaved >= Number(goal.target_amount);

      await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", schedule.user_id);

      await supabase.from("savings_goals").update({
        saved_amount: newSaved,
        status: completed ? "completed" : "active",
        updated_at: new Date().toISOString(),
      }).eq("id", goalId);

      await supabase.from("savings_deposits").insert({
        goal_id: goalId,
        user_id: schedule.user_id,
        amount: schedule.amount,
        source: "auto",
      });

      await supabase.from("transactions").insert({
        user_id: schedule.user_id,
        type: "payment",
        amount: schedule.amount,
        fee: 0,
        description: `DPS Installment: ${goal.name} (#${(schedule.total_paid ?? 0) + 1})`,
        reference: `DPS-INST-${schedule.id.substring(0, 8)}-${(schedule.total_paid ?? 0) + 1}`,
        status: "completed",
        balance_after: newBalance,
      });

      await supabase.from("savings_auto_save").update({
        next_run_at: nextRun.toISOString(),
        last_run_at: new Date().toISOString(),
        total_paid: (schedule.total_paid ?? 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq("id", schedule.id);

      const successTitle = completed ? "🎉 Goal Completed!" : "✅ DPS Installment Collected";
      const successBody = `৳${schedule.amount} auto-collected to "${goal.name}"${completed ? " — Goal completed!" : `. Installment ${(schedule.total_paid ?? 0) + 1}/${schedule.total_installments ?? "∞"}`}`;
      await supabase.from("notifications").insert({
        user_id: schedule.user_id,
        title: successTitle,
        body: successBody,
        category: "savings",
      });
      await sendPush(schedule.user_id, successTitle, successBody);

      processed++;
    }

    return new Response(JSON.stringify({ processed, skipped, settled, missed, dedup }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

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

    for (const schedule of schedules ?? []) {
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
          // No goal — still track as missed if no balance
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
        // Record missed payment
        await supabase.from("dps_missed_payments").insert({
          schedule_id: schedule.id,
          user_id: schedule.user_id,
          amount: schedule.amount,
          due_date: new Date().toISOString(),
        });

        // Update schedule counters
        await supabase.from("savings_auto_save").update({
          missed_count: (schedule.missed_count ?? 0) + 1,
          last_missed_at: new Date().toISOString(),
          next_run_at: nextRun.toISOString(),
          last_run_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", schedule.id);

        // Notify user about missed payment
        await supabase.from("notifications").insert({
          user_id: schedule.user_id,
          title: "⚠️ DPS Installment Missed",
          body: `Insufficient balance for ৳${schedule.amount} DPS installment. You can repay later from Savings > Active Plans.`,
          category: "savings",
        });

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

      // Deduct balance
      await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", schedule.user_id);

      // Credit goal
      await supabase.from("savings_goals").update({
        saved_amount: newSaved,
        status: completed ? "completed" : "active",
        updated_at: new Date().toISOString(),
      }).eq("id", goalId);

      // Deposit record
      await supabase.from("savings_deposits").insert({
        goal_id: goalId,
        user_id: schedule.user_id,
        amount: schedule.amount,
        source: "auto",
      });

      // Record in transactions table so it appears in history
      await supabase.from("transactions").insert({
        user_id: schedule.user_id,
        type: "payment",
        amount: schedule.amount,
        fee: 0,
        description: `DPS Installment: ${goal.name} (#${(schedule.total_paid ?? 0) + 1})`,
        reference: `DPS-INST-${schedule.id.substring(0, 8)}`,
        status: "completed",
        balance_after: newBalance,
      });

      // Update schedule with next run + increment total_paid
      await supabase.from("savings_auto_save").update({
        next_run_at: nextRun.toISOString(),
        last_run_at: new Date().toISOString(),
        total_paid: (schedule.total_paid ?? 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq("id", schedule.id);

      // Notify user
      await supabase.from("notifications").insert({
        user_id: schedule.user_id,
        title: completed ? "🎉 Goal Completed!" : "✅ DPS Installment Collected",
        body: `৳${schedule.amount} auto-collected to "${goal.name}"${completed ? " — Goal completed!" : `. Installment ${(schedule.total_paid ?? 0) + 1}/${schedule.total_installments ?? "∞"}`}`,
        category: "savings",
      });

      processed++;
    }

    return new Response(JSON.stringify({ processed, skipped, settled, missed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

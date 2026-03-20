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

    // Get all due recurring donations
    const { data: schedules, error: fetchErr } = await supabase
      .from("recurring_donations")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_at", new Date().toISOString());

    if (fetchErr) throw fetchErr;

    let processed = 0;
    let skipped = 0;

    for (const schedule of schedules ?? []) {
      // Check balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("user_id", schedule.user_id)
        .single();

      if (!profile || Number(profile.balance) < Number(schedule.amount)) {
        await supabase.from("notifications").insert({
          user_id: schedule.user_id,
          title: "Recurring Donation Skipped",
          body: `Insufficient balance for ৳${schedule.amount} donation to ${schedule.cause_name}. Please top up your wallet.`,
          category: "donation",
        });
        skipped++;
        continue;
      }

      // Deduct balance
      const newBalance = Number(profile.balance) - Number(schedule.amount);
      await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", schedule.user_id);

      // Credit platform treasury
      const { data: treasury } = await supabase
        .from("platform_treasury")
        .select("*")
        .limit(1)
        .single();

      if (treasury) {
        const newTreasuryBalance = Number(treasury.balance) + Number(schedule.amount);
        await supabase.from("platform_treasury").update({
          balance: newTreasuryBalance,
          total_earnings: Number(treasury.total_earnings) + Number(schedule.amount),
          updated_at: new Date().toISOString(),
        }).eq("id", treasury.id);

        await supabase.from("treasury_ledger").insert({
          type: "earning",
          amount: schedule.amount,
          balance_after: newTreasuryBalance,
          counterparty_user_id: schedule.user_id,
          description: `Recurring Donation: ${schedule.cause_name}`,
          reference: `RDON-${schedule.cause_name.toUpperCase().replace(/\s+/g, "-")}`,
        });
      }

      // Upsert per-cause fund tracking
      await supabase.from("donation_cause_funds").upsert(
        {
          cause_name: schedule.cause_name,
          cause_icon: schedule.cause_icon,
          balance: Number(schedule.amount),
          total_raised: Number(schedule.amount),
          donor_count: 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "cause_name", ignoreDuplicates: false }
      );
      // Increment existing row properly via RPC-style raw update
      const { data: existingFund } = await supabase
        .from("donation_cause_funds")
        .select("balance, total_raised, donor_count")
        .eq("cause_name", schedule.cause_name)
        .single();

      if (existingFund && (existingFund.total_raised > Number(schedule.amount))) {
        // Row existed before upsert overwrote it — already handled by DB trigger
        // The upsert above created the row if new; for existing rows we need to use the RPC approach
      }

      // Record transaction
      await supabase.from("transactions").insert({
        user_id: schedule.user_id,
        type: "payment",
        amount: schedule.amount,
        fee: 0,
        balance_after: newBalance,
        description: `Recurring Donation: ${schedule.cause_name}${schedule.message ? ` — ${schedule.message}` : ""}`,
        reference: `RDON-${schedule.cause_name.toUpperCase().replace(/\s+/g, "-")}`,
        status: "completed",
      });

      // Record in donations table
      await supabase.from("donations").insert({
        user_id: schedule.user_id,
        cause_name: schedule.cause_name,
        cause_icon: schedule.cause_icon,
        amount: schedule.amount,
        message: schedule.message,
        is_anonymous: schedule.is_anonymous,
      });

      // Calculate next run
      const nextRun = new Date();
      if (schedule.frequency === "weekly") nextRun.setDate(nextRun.getDate() + 7);
      else if (schedule.frequency === "yearly") nextRun.setFullYear(nextRun.getFullYear() + 1);
      else nextRun.setMonth(nextRun.getMonth() + 1);

      await supabase.from("recurring_donations").update({
        next_run_at: nextRun.toISOString(),
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", schedule.id);

      // Notify user
      await supabase.from("notifications").insert({
        user_id: schedule.user_id,
        title: "💚 Recurring Donation Processed",
        body: `৳${schedule.amount} donated to ${schedule.cause_name} (${schedule.frequency}).`,
        category: "donation",
      });

      processed++;
    }

    return new Response(JSON.stringify({ processed, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

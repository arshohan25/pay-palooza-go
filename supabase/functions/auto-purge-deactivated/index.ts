import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Find all deactivated users past their grace period
    const { data: expiredUsers, error: fetchError } = await adminClient
      .from("profiles")
      .select("user_id, name, phone, balance")
      .eq("status", "deactivated")
      .lt("scheduled_deletion_at", new Date().toISOString());

    if (fetchError) {
      console.error("Failed to fetch expired users:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      return new Response(JSON.stringify({ purged: 0, message: "No expired users to purge" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tablesToClean = [
      { table: "referral_rewards", column: "referrer_id" },
      { table: "referrals", column: "referrer_id" },
      { table: "referrals", column: "referee_id" },
      { table: "support_messages", column: "sender_id" },
      { table: "support_conversations", column: "user_id" },
      { table: "notifications", column: "user_id" },
      { table: "transactions", column: "user_id" },
      { table: "feature_locks", column: "target_user_id" },
      { table: "fraud_alerts", column: "user_id" },
      { table: "kyc_verifications", column: "user_id" },
      { table: "user_permissions", column: "user_id" },
      { table: "device_registrations", column: "user_id" },
      { table: "saved_bank_accounts", column: "user_id" },
      { table: "payment_sessions", column: "user_id" },
      { table: "orders", column: "user_id" },
      { table: "agents", column: "user_id" },
      { table: "merchants", column: "user_id" },
      { table: "distributors", column: "user_id" },
      { table: "user_roles", column: "user_id" },
      { table: "transfer_rate_limits", column: "user_id" },
      { table: "profiles", column: "user_id" },
    ];

    let purged = 0;
    let failed = 0;

    for (const user of expiredUsers) {
      try {
        // Credit remaining balance to treasury before cleanup
        if (user.balance > 0) {
          const { data: treasury } = await adminClient
            .from("platform_treasury")
            .select("id, balance, total_earnings")
            .limit(1)
            .single();

          if (treasury) {
            const newTreasuryBalance = treasury.balance + user.balance;
            await adminClient
              .from("platform_treasury")
              .update({
                balance: newTreasuryBalance,
                total_earnings: treasury.total_earnings + user.balance,
                updated_at: new Date().toISOString(),
              })
              .eq("id", treasury.id);

            await adminClient.from("treasury_ledger").insert({
              type: "earning",
              amount: user.balance,
              balance_after: newTreasuryBalance,
              counterparty_user_id: user.user_id,
              description: "Recovered balance from auto-purged user account",
              reference: "AUTO-PURGE-" + user.user_id.substring(0, 8),
            });

            console.log(`Recovered ৳${user.balance} from purged user ${user.user_id}`);
          }
        }

        // Cascading delete from all public tables
        for (const { table, column } of tablesToClean) {
          await adminClient.from(table).delete().eq(column, user.user_id);
        }

        // Audit log
        await adminClient.from("audit_logs").insert({
          actor_id: user.user_id, // self-reference since it's automated
          action: "auto_purge_user",
          entity_type: "user",
          entity_id: user.user_id,
          details: {
            purged_user_name: user.name,
            purged_user_phone: user.phone,
            purged_user_balance: user.balance,
            balance_recovered: user.balance > 0 ? user.balance : 0,
            reason: "Grace period expired",
          },
        });

        // Delete from auth.users
        const { error: authError } = await adminClient.auth.admin.deleteUser(user.user_id);
        if (authError) {
          console.error(`Failed to delete auth user ${user.user_id}:`, authError);
          failed++;
          continue;
        }

        purged++;
        console.log(`Auto-purged user: ${user.user_id} (${user.name || user.phone})`);
      } catch (err) {
        console.error(`Failed to purge user ${user.user_id}:`, err);
        failed++;
      }
    }

    return new Response(JSON.stringify({
      purged,
      failed,
      total_expired: expiredUsers.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("auto-purge error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

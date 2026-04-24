import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function archiveUserData(adminClient: any, userId: string, deletedBy: string, balanceRecovered: number) {
  const [
    profileRes, txnRes, rolesRes, kycRes, notiRes,
    supportConvRes, supportMsgRes, referralsRes, referralRewardsRes,
    agentsRes, merchantsRes, distributorsRes, ordersRes,
    deviceRes, savedBanksRes, permissionsRes, featureLocksRes
  ] = await Promise.all([
    adminClient.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    adminClient.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    adminClient.from("user_roles").select("*").eq("user_id", userId),
    adminClient.from("kyc_verifications").select("*").eq("user_id", userId).maybeSingle(),
    adminClient.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
    adminClient.from("support_conversations").select("*").eq("user_id", userId),
    adminClient.from("support_messages").select("*").eq("sender_id", userId),
    adminClient.from("referrals").select("*").or(`referrer_id.eq.${userId},referee_id.eq.${userId}`),
    adminClient.from("referral_rewards").select("*").eq("referrer_id", userId),
    adminClient.from("agents").select("*").eq("user_id", userId),
    adminClient.from("merchants").select("*").eq("user_id", userId),
    adminClient.from("distributors").select("*").eq("user_id", userId),
    adminClient.from("orders").select("*").eq("user_id", userId),
    adminClient.from("device_registrations").select("*").eq("user_id", userId),
    adminClient.from("saved_bank_accounts").select("*").eq("user_id", userId),
    adminClient.from("user_permissions").select("*").eq("user_id", userId),
    adminClient.from("feature_locks").select("*").eq("target_user_id", userId),
  ]);

  const profile = profileRes.data;

  const { error: archiveError } = await adminClient.from("deleted_users").insert({
    user_id: userId,
    name: profile?.name || null,
    phone: profile?.phone || null,
    avatar_url: profile?.avatar_url || null,
    balance_at_deletion: profile?.balance || 0,
    profile_data: profile || {},
    transactions: txnRes.data || [],
    roles: rolesRes.data || [],
    kyc_data: kycRes.data || {},
    notifications: notiRes.data || [],
    support_conversations: {
      conversations: supportConvRes.data || [],
      messages: supportMsgRes.data || [],
    },
    referrals: {
      referrals: referralsRes.data || [],
      rewards: referralRewardsRes.data || [],
    },
    other_data: {
      agents: agentsRes.data || [],
      merchants: merchantsRes.data || [],
      distributors: distributorsRes.data || [],
      orders: ordersRes.data || [],
      devices: deviceRes.data || [],
      saved_banks: savedBanksRes.data || [],
      permissions: permissionsRes.data || [],
      feature_locks: featureLocksRes.data || [],
    },
    deleted_by: deletedBy,
    deletion_reason: "Auto-purge: grace period expired",
    balance_recovered: balanceRecovered,
  });

  if (archiveError) {
    console.error("Failed to archive user data:", archiveError);
    // Don't throw — log and continue with purge
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify shared secret for cron-only access
  const authHeader = req.headers.get("Authorization");
  const secret = Deno.env.get("AUTO_PURGE_SECRET");
  if (!secret || !authHeader || authHeader !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
        let balanceRecovered = 0;
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

            balanceRecovered = user.balance;
            console.log(`Recovered ৳${user.balance} from purged user ${user.user_id}`);

            // Notify all admins about balance recovery
            const { data: admins } = await adminClient
              .from("user_roles")
              .select("user_id")
              .eq("role", "admin");

            if (admins?.length) {
              const userName = user.name || user.phone;
              await adminClient.from("notifications").insert(
                admins.map((a: { user_id: string }) => ({
                  user_id: a.user_id,
                  title: "Balance Recovered from Purged User",
                  body: `৳${user.balance} recovered from ${userName} and credited to treasury`,
                  category: "system",
                  metadata: { type: "balance_recovery", amount: user.balance, user_name: userName, source: "auto_purge" },
                }))
              );
            }
          }
        }

        // Archive user data to trash before deleting
        await archiveUserData(adminClient, user.user_id, user.user_id, balanceRecovered);

        // Cascading delete from all public tables
        for (const { table, column } of tablesToClean) {
          await adminClient.from(table).delete().eq(column, user.user_id);
        }

        // Audit log
        await adminClient.from("audit_logs").insert({
          actor_id: user.user_id,
          action: "auto_purge_user",
          entity_type: "user",
          entity_id: user.user_id,
          details: {
            purged_user_name: user.name,
            purged_user_phone: user.phone,
            purged_user_balance: user.balance,
            balance_recovered: user.balance > 0 ? user.balance : 0,
            reason: "Grace period expired",
            archived_to_trash: true,
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
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

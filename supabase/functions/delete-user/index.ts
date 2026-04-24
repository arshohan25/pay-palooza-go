import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function archiveUserData(adminClient: any, userId: string, deletedBy: string, balanceRecovered: number) {
  // Snapshot all user data before deletion
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
    balance_recovered: balanceRecovered,
  });

  if (archiveError) {
    console.error("Failed to archive user data:", archiveError);
    throw new Error("Failed to archive user data: " + archiveError.message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin using their JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await anonClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { target_user_id, force } = await req.json();
    if (!target_user_id) {
      return new Response(JSON.stringify({ error: "target_user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-deletion
    if (target_user_id === caller.id) {
      return new Response(JSON.stringify({ error: "Cannot delete your own account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get target profile info for audit
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("name, phone, balance, status, scheduled_deletion_at")
      .eq("user_id", target_user_id)
      .maybeSingle();

    if (!targetProfile) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Grace period check
    if (
      targetProfile.status === "deactivated" &&
      targetProfile.scheduled_deletion_at &&
      new Date(targetProfile.scheduled_deletion_at) > new Date() &&
      !force
    ) {
      const daysLeft = Math.ceil(
        (new Date(targetProfile.scheduled_deletion_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return new Response(JSON.stringify({
        error: `User is in grace period. ${daysLeft} days remaining. Pass force: true to override.`,
        grace_period: true,
        days_remaining: daysLeft,
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Credit remaining balance to treasury before cleanup
    let balanceRecovered = 0;
    if (targetProfile.balance > 0) {
      const { data: treasury } = await adminClient
        .from("platform_treasury")
        .select("id, balance, total_earnings")
        .limit(1)
        .single();

      if (treasury) {
        const newTreasuryBalance = treasury.balance + targetProfile.balance;
        await adminClient
          .from("platform_treasury")
          .update({
            balance: newTreasuryBalance,
            total_earnings: treasury.total_earnings + targetProfile.balance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", treasury.id);

        await adminClient.from("treasury_ledger").insert({
          type: "earning",
          amount: targetProfile.balance,
          balance_after: newTreasuryBalance,
          counterparty_user_id: target_user_id,
          description: "Recovered balance from deleted user account",
          reference: "USER-DELETE-" + target_user_id.substring(0, 8),
        });

        balanceRecovered = targetProfile.balance;
        console.log(`Recovered ৳${balanceRecovered} from deleted user ${target_user_id}`);

        // Notify all admins about balance recovery
        const { data: admins } = await adminClient
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        if (admins?.length) {
          const userName = targetProfile.name || targetProfile.phone;
          await adminClient.from("notifications").insert(
            admins.map((a: { user_id: string }) => ({
              user_id: a.user_id,
              title: "Balance Recovered from Deleted User",
              body: `৳${balanceRecovered} recovered from ${userName} and credited to treasury`,
              category: "system",
              metadata: { type: "balance_recovery", amount: balanceRecovered, user_name: userName, source: "manual_delete" },
            }))
          );
        }
      }
    }

    // Archive user data to trash before deleting
    await archiveUserData(adminClient, target_user_id, caller.id, balanceRecovered);

    // Delete from all public tables (order matters for FK constraints)
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

    for (const { table, column } of tablesToClean) {
      await adminClient.from(table).delete().eq(column, target_user_id);
    }

    // Insert audit log before deleting auth user
    await adminClient.from("audit_logs").insert({
      actor_id: caller.id,
      action: "permanent_delete_user",
      entity_type: "user",
      entity_id: target_user_id,
      details: {
        deleted_user_name: targetProfile.name,
        deleted_user_phone: targetProfile.phone,
        deleted_user_balance: targetProfile.balance,
        balance_recovered: balanceRecovered,
        archived_to_trash: true,
      },
    });

    // Delete from auth.users using admin API
    const { error: authError } = await adminClient.auth.admin.deleteUser(target_user_id);
    if (authError) {
      console.error("Failed to delete auth user:", authError);
      return new Response(JSON.stringify({ error: "Failed to delete auth user: " + authError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      deleted_user: {
        name: targetProfile.name,
        phone: targetProfile.phone,
      },
      balance_recovered: balanceRecovered,
      archived: true,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("delete-user error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

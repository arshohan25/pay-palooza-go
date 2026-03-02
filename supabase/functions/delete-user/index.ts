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

    const { target_user_id } = await req.json();
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
      .select("name, phone, balance")
      .eq("user_id", target_user_id)
      .maybeSingle();

    if (!targetProfile) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("delete-user error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

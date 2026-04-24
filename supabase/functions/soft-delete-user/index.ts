import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const { target_user_id, action } = await req.json();
    if (!target_user_id) {
      return new Response(JSON.stringify({ error: "target_user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (target_user_id === caller.id) {
      return new Response(JSON.stringify({ error: "Cannot deactivate your own account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get target profile
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("name, phone, status, deactivated_at")
      .eq("user_id", target_user_id)
      .maybeSingle();

    if (!targetProfile) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle reactivation
    if (action === "reactivate") {
      if (targetProfile.status !== "deactivated") {
        return new Response(JSON.stringify({ error: "User is not deactivated" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await adminClient
        .from("profiles")
        .update({
          status: "active",
          deactivated_at: null,
          scheduled_deletion_at: null,
          deactivated_by: null,
        })
        .eq("user_id", target_user_id);

      if (error) throw error;

      await adminClient.from("audit_logs").insert({
        actor_id: caller.id,
        action: "reactivate_user",
        entity_type: "user",
        entity_id: target_user_id,
        details: {
          user_name: targetProfile.name,
          user_phone: targetProfile.phone,
        },
      });

      return new Response(JSON.stringify({ success: true, action: "reactivated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Soft-delete: set status to deactivated with 30-day grace period
    if (targetProfile.status === "deactivated") {
      return new Response(JSON.stringify({ error: "User is already deactivated" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const scheduledDeletion = new Date(now);
    scheduledDeletion.setDate(scheduledDeletion.getDate() + 30);

    const { error } = await adminClient
      .from("profiles")
      .update({
        status: "deactivated",
        deactivated_at: now.toISOString(),
        scheduled_deletion_at: scheduledDeletion.toISOString(),
        deactivated_by: caller.id,
      })
      .eq("user_id", target_user_id);

    if (error) throw error;

    await adminClient.from("audit_logs").insert({
      actor_id: caller.id,
      action: "soft_delete_user",
      entity_type: "user",
      entity_id: target_user_id,
      details: {
        user_name: targetProfile.name,
        user_phone: targetProfile.phone,
        scheduled_deletion_at: scheduledDeletion.toISOString(),
      },
    });

    return new Response(JSON.stringify({
      success: true,
      action: "deactivated",
      scheduled_deletion_at: scheduledDeletion.toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("soft-delete-user error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

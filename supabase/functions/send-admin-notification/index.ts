
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminId = claimsData.claims.sub as string;

    // Check admin role
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleCheck } = await serviceClient
      .from("user_roles")
      .select("id")
      .eq("user_id", adminId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { title, body, category, target_roles, target_area, target_user, metadata } =
      await req.json();

    // target_user activity filter values:
    // high_txn, low_txn, inactive, txn_10+, txn_20+, txn_50+, txn_80+, txn_100+

    if (!title || !body) {
      return new Response(JSON.stringify({ error: "Title and body are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find target user IDs based on roles
    let userIds: string[] = [];
    const roles = (target_roles || []) as string[];

    if (roles.length === 0 || roles.includes("all")) {
      // All users
      const { data: allProfiles } = await serviceClient
        .from("profiles")
        .select("user_id")
        .eq("status", "active");
      userIds = (allProfiles || []).map((p: any) => p.user_id);
    } else {
      // Get user IDs that have any of the specified roles
      const { data: roleUsers } = await serviceClient
        .from("user_roles")
        .select("user_id")
        .in("role", roles);

      if (roles.includes("customer")) {
        // "customer" = users who have NO role in user_roles (regular users)
        const { data: allProfiles } = await serviceClient
          .from("profiles")
          .select("user_id")
          .eq("status", "active");
        const { data: allRoleUsers } = await serviceClient
          .from("user_roles")
          .select("user_id");
        const roleUserSet = new Set((allRoleUsers || []).map((r: any) => r.user_id));
        const customers = (allProfiles || [])
          .filter((p: any) => !roleUserSet.has(p.user_id))
          .map((p: any) => p.user_id);
        userIds = [...new Set([...customers, ...(roleUsers || []).map((r: any) => r.user_id)])];
      } else {
        userIds = [...new Set((roleUsers || []).map((r: any) => r.user_id))];
      }
    }

    // Batch insert notifications in chunks of 100
    const notifCategory = category || "system";
    const notifMetadata = metadata || {};
    let inserted = 0;

    for (let i = 0; i < userIds.length; i += 100) {
      const chunk = userIds.slice(i, i + 100);
      const rows = chunk.map((uid: string) => ({
        user_id: uid,
        title,
        body,
        category: notifCategory,
        metadata: notifMetadata,
        read: false,
      }));

      const { error: insertErr } = await serviceClient.from("notifications").insert(rows);
      if (!insertErr) inserted += chunk.length;
    }

    // Record in admin_notifications
    await serviceClient.from("admin_notifications").insert({
      admin_id: adminId,
      title,
      body,
      category: notifCategory,
      target_roles: roles,
      target_area: target_area || null,
      target_user: target_user || null,
      metadata: notifMetadata,
      sent_count: inserted,
    });

    return new Response(
      JSON.stringify({ success: true, sent_count: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

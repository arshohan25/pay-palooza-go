import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEAM_EMAIL_DOMAIN = "team.easypay.app";

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

    const {
      username,
      password,
      displayName,
      email,
      role,
      department,
      notes,
      permissions,
    } = await req.json();

    // Validate required fields
    if (!username || !password || !displayName) {
      return new Response(JSON.stringify({ error: "username, password, and displayName are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller identity
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await userClient.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminId = caller.id;

    // Verify admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", adminId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user via admin API (no client-side session contamination)
    const normalizedUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
    const syntheticEmail = `${normalizedUsername}@${TEAM_EMAIL_DOMAIN}`;

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        is_team_member: true,
      },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = newUser.user.id;

    // Insert profile
    await adminClient.from("profiles").insert({
      user_id: newUserId,
      phone: `TEAM-${normalizedUsername}`,
      name: displayName.trim(),
      status: "active",
    });

    // Insert team_members record (no plaintext password stored)
    await adminClient.from("team_members").insert({
      user_id: newUserId,
      display_name: displayName.trim(),
      department: department || "general",
      notes: notes || null,
      created_by: adminId,
      username: normalizedUsername,
      email: email?.trim() || null,
    });

    // Insert role
    await adminClient.from("user_roles").insert({
      user_id: newUserId,
      role: role || "compliance",
    });

    // Insert permissions
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      const perms = permissions.map((p: any) => ({
        user_id: newUserId,
        section: p.section,
        can_view: p.can_view ?? false,
        can_add: p.can_add ?? false,
        can_edit: p.can_edit ?? false,
        can_delete: p.can_delete ?? false,
        granted_by: adminId,
      }));
      await adminClient.from("team_access_permissions").upsert(perms, {
        onConflict: "user_id,section",
      });
    }

    // Audit log
    await adminClient.from("audit_logs").insert({
      actor_id: adminId,
      action: "team_member_created",
      entity_type: "team",
      entity_id: newUserId,
      details: {
        display_name: displayName.trim(),
        username: normalizedUsername,
        role: role || "compliance",
        department: department || "general",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        userId: newUserId,
        username: normalizedUsername,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

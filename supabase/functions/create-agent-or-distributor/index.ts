import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DOMAINS = ["easypay.app", "example.com", "easypay.local"];

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

    const body = await req.json();
    const {
      type, // "agent" or "distributor"
      phone,
      name,
      business_name,
      nid_number,
      territory_code,
      trade_license,
      max_float,
      commission_rate,
      territories,
    } = body;

    if (!type || !["agent", "distributor"].includes(type)) {
      return new Response(JSON.stringify({ error: "type must be 'agent' or 'distributor'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!phone) {
      return new Response(JSON.stringify({ error: "phone is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await userClient.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller has proper role
    if (type === "agent") {
      // Caller must be a distributor or admin
      const { data: callerRoles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id);
      const roles = (callerRoles ?? []).map((r: any) => r.role);
      if (!roles.includes("admin") && !roles.includes("distributor") && !roles.includes("super_distributor")) {
        return new Response(JSON.stringify({ error: "Forbidden: distributor or admin role required" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Creating distributor: caller must be super_distributor or admin
      const { data: callerRoles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id);
      const roles = (callerRoles ?? []).map((r: any) => r.role);
      if (!roles.includes("admin") && !roles.includes("super_distributor")) {
        return new Response(JSON.stringify({ error: "Forbidden: super_distributor or admin role required" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Normalize phone
    const cleaned = phone.replace(/\D/g, "").replace(/^(\+?88)/, "");
    if (!/^01[3-9]\d{8}$/.test(cleaned)) {
      return new Response(JSON.stringify({ error: "Invalid phone number" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if phone already registered
    const { data: existing } = await adminClient
      .from("profiles")
      .select("id")
      .eq("phone", cleaned)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ error: "This phone number is already registered" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create auth account
    const randomPin = String(Math.floor(1000 + Math.random() * 9000));
    const syntheticEmail = `${cleaned}@${DOMAINS[0]}`;
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: syntheticEmail,
      password: `${randomPin}EP`,
      email_confirm: true,
      user_metadata: {
        display_name: name || business_name || cleaned,
        name: name || business_name || null,
      },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = newUser.user.id;

    // Assign role (using service role - bypasses RLS)
    await adminClient.from("user_roles").insert({
      user_id: newUserId,
      role: type,
    });

    if (type === "agent") {
      // Get caller's distributor record
      const { data: distData } = await adminClient
        .from("distributors")
        .select("id")
        .eq("user_id", caller.id)
        .maybeSingle();

      await adminClient.from("agents").insert({
        user_id: newUserId,
        distributor_id: distData?.id || null,
        business_name: business_name || name || cleaned,
        nid_number: nid_number || null,
        territory_code: territory_code || null,
        trade_license: trade_license || null,
        max_float: Number(max_float) || 500000,
        status: "active",
      });
    } else {
      // Get caller's distributor record as parent
      const { data: parentDist } = await adminClient
        .from("distributors")
        .select("id")
        .eq("user_id", caller.id)
        .maybeSingle();

      const parsedTerritories = Array.isArray(territories) && territories.length > 0
        ? territories
        : null;

      await adminClient.from("distributors").insert({
        user_id: newUserId,
        business_name: business_name,
        max_float: Number(max_float) || 10000000,
        commission_rate: Number(commission_rate) || 0.002,
        territory: parsedTerritories,
        parent_id: parentDist?.id || null,
        status: "active",
      });
    }

    // Update profile
    await adminClient.from("profiles")
      .update({ name: name || null, phone: cleaned })
      .eq("user_id", newUserId);

    // Audit log
    await adminClient.from("audit_logs").insert({
      actor_id: caller.id,
      action: `created_${type}`,
      entity_type: type,
      entity_id: newUserId,
      details: {
        phone: cleaned,
        business_name: business_name || null,
        name: name || null,
      },
    });

    return new Response(
      JSON.stringify({ success: true, userId: newUserId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

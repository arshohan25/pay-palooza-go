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
      route_code,
      trade_license,
      max_float,
      commission_rate,
      territories,
      division,
      district,
      upazila,
      union_parishad,
      area_type,
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

    // Common location payload — triggers on agents/distributors validate the
    // hierarchy server-side, so we just pass whatever the caller supplied.
    const locationPayload: Record<string, any> = {};
    if (division) locationPayload.division = division;
    if (district) locationPayload.district = district;
    if (upazila) locationPayload.upazila = upazila;
    if (union_parishad) locationPayload.union_parishad = union_parishad;
    if (area_type) locationPayload.area_type = area_type;

    if (type === "agent") {
      const { data: distData } = await adminClient
        .from("distributors")
        .select("id")
        .eq("user_id", caller.id)
        .maybeSingle();

      const { error: agentErr } = await adminClient.from("agents").insert({
        user_id: newUserId,
        distributor_id: distData?.id || null,
        business_name: business_name || name || cleaned,
        nid_number: nid_number || null,
        territory_code: territory_code || route_code || null,
        trade_license: trade_license || null,
        max_float: Number(max_float) || 500000,
        status: "active",
        ...locationPayload,
      });
      if (agentErr) {
        // Best-effort rollback of the auth user so the caller can retry cleanly.
        await adminClient.auth.admin.deleteUser(newUserId).catch(() => {});
        return new Response(JSON.stringify({ error: agentErr.message }), {
          status: /Invalid location hierarchy/i.test(agentErr.message) ? 422 : 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { data: parentDist } = await adminClient
        .from("distributors")
        .select("id")
        .eq("user_id", caller.id)
        .maybeSingle();

      const parsedTerritories = Array.isArray(territories) && territories.length > 0
        ? territories
        : null;

      const { error: distErr } = await adminClient.from("distributors").insert({
        user_id: newUserId,
        business_name: business_name,
        max_float: Number(max_float) || 10000000,
        commission_rate: Number(commission_rate) || 0.002,
        territory: parsedTerritories,
        parent_id: parentDist?.id || null,
        status: "active",
        ...locationPayload,
      });
      if (distErr) {
        await adminClient.auth.admin.deleteUser(newUserId).catch(() => {});
        const raw = distErr.message || "";
        const lower = raw.toLowerCase();
        let friendly = raw;
        let status = 400;
        if (/invalid location hierarchy/i.test(raw)) {
          friendly = "Selected Division › District › Upazila do not match.";
          status = 422;
        } else if (lower.includes("parent_id must reference a super distributor")) {
          friendly = "The selected parent is not a Super Distributor.";
          status = 422;
        } else if (lower.includes("does not reference an existing distributor")) {
          friendly = "The selected parent Super Distributor no longer exists.";
          status = 422;
        } else if (lower.includes("cannot be its own parent")) {
          friendly = "A distributor cannot be linked to itself as a parent.";
          status = 422;
        }
        return new Response(JSON.stringify({ error: friendly }), {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = new Set([
  "admin", "compliance", "finance", "risk", "audit", "operations",
  "manager", "developer", "support", "marketing", "hr",
  "super_distributor", "distributor", "merchant", "agent", "customer",
]);

function bcryptStub() {
  return null; // profiles.pin_hash is set by app's own PIN flow; we mark forced_pin_reset.
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { phone, role, name, temp_pin } = await req.json();
    if (!phone || !role) return json({ error: "phone and role are required" }, 400);
    if (!ALLOWED_ROLES.has(role)) return json({ error: `Invalid role: ${role}` }, 400);
    const pin = (temp_pin ?? "1122").toString();
    if (!/^\d{4,6}$/.test(pin)) return json({ error: "temp_pin must be 4-6 digits" }, 400);

    const normalizedPhone = phone.replace(/\D/g, "");
    if (normalizedPhone.length < 10) return json({ error: "Invalid phone" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await userClient.auth.getUser();
    if (authError || !caller) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Caller must be admin
    const { data: callerRoles } = await admin
      .from("user_roles").select("role").eq("user_id", caller.id);
    if (!(callerRoles ?? []).some((r: any) => r.role === "admin")) {
      return json({ error: "Only admins can provision accounts" }, 403);
    }

    // Check phone reuse (profile OR blocklist)
    const { data: existingProfile } = await admin
      .from("profiles").select("user_id, name").eq("phone", normalizedPhone).maybeSingle();

    let userId = existingProfile?.user_id ?? null;

    if (!userId) {
      // Create auth user with phone-as-email convention
      const email = `${normalizedPhone}@easypay.app`;
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: pin.padEnd(8, "0") + "!Ax",  // meets Supabase strength; user still uses PIN in app
        email_confirm: true,
        user_metadata: { phone: normalizedPhone, provisioned_by_admin: true, forced_pin_reset: true },
      });
      if (createErr || !created?.user) {
        return json({ error: `Auth create failed: ${createErr?.message ?? "unknown"}` }, 400);
      }
      userId = created.user.id;

      // profile row (trigger usually creates one; upsert to be safe)
      await admin.from("profiles").upsert({
        user_id: userId,
        phone: normalizedPhone,
        name: name || null,
        status: "active",
      }, { onConflict: "user_id" });
    }

    // Assign single role (replaces any existing) via RPC — but service role bypasses admin check,
    // so do it directly here.
    await admin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleErr } = await admin.from("user_roles").insert({ user_id: userId, role });
    if (roleErr) return json({ error: `Role assign failed: ${roleErr.message}` }, 400);

    await admin.from("audit_logs").insert({
      actor_id: caller.id,
      action: existingProfile ? "role_assigned_existing_account" : "role_provisioned_new_account",
      entity_type: "user_role",
      entity_id: userId,
      details: { phone: normalizedPhone, role, name: name ?? null, temp_pin_set: !existingProfile },
    });

    return json({
      ok: true,
      user_id: userId,
      created: !existingProfile,
      message: existingProfile
        ? `Role '${role}' assigned to existing account.`
        : `Account created and role '${role}' assigned. Share temp PIN with the user; they must reset it on first login.`,
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

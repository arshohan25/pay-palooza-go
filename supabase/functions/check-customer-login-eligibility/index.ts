// Server-side guard: given a phone, reject login attempts on the customer app
// if the account holds any elevated role (agent, merchant, distributor,
// super_distributor, admin). Runs BEFORE any session is created.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ELEVATED = ["agent", "merchant", "distributor", "super_distributor", "admin"];
const PORTALS: Record<string, string> = {
  agent: "/agent/login",
  merchant: "/merchant-login",
  distributor: "/distributor/login",
  super_distributor: "/sd/login",
  admin: "/admin/login",
};

function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("88") && digits.length === 13) return digits.slice(2);
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { phone } = await req.json().catch(() => ({}));
    const normalized = normalizePhone(String(phone ?? ""));
    if (!/^01\d{9}$/.test(normalized)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid phone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up any auth user IDs tied to this phone. Match both the profile
    // row (phone column) AND the phone-as-email convention used at signup
    // (`<phone>@easypay.app`), because merchant/agent/etc. accounts often
    // exist only in auth.users without a corresponding profiles row.
    const emailAlias = `${normalized}@easypay.app`;

    const [{ data: profile, error: pErr }, { data: authList, error: aErr }] =
      await Promise.all([
        admin.from("profiles").select("id").eq("phone", normalized).maybeSingle(),
        admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
      ]);
    if (pErr) throw pErr;
    if (aErr) throw aErr;

    const userIds = new Set<string>();
    if (profile?.id) userIds.add(profile.id);
    for (const u of authList?.users ?? []) {
      if (u.email?.toLowerCase() === emailAlias) userIds.add(u.id);
    }

    if (userIds.size === 0) {
      return new Response(
        JSON.stringify({ ok: true, allowed: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: roles, error: rErr } = await admin
      .from("user_roles")
      .select("role")
      .in("user_id", Array.from(userIds));
    if (rErr) throw rErr;

    // Also treat existence of a merchant/distributor row as elevated, in case
    // user_roles wasn't backfilled for legacy accounts.
    const [{ data: mRows }, { data: dRows }] = await Promise.all([
      admin.from("merchants").select("id").in("user_id", Array.from(userIds)).limit(1),
      admin.from("distributors").select("id, role").in("user_id", Array.from(userIds)).limit(1),
    ]);
    const inferred: string[] = [];
    if ((mRows ?? []).length) inferred.push("merchant");
    for (const d of dRows ?? []) {
      inferred.push((d as any).role === "super_distributor" ? "super_distributor" : "distributor");
    }
    const allRoles = [...(roles ?? []).map((r) => r.role as string), ...inferred];

    const elevated = allRoles.find((r) => ELEVATED.includes(r));

    if (elevated) {
      return new Response(
        JSON.stringify({
          ok: true,
          allowed: false,
          role: elevated,
          portal: PORTALS[elevated],
          message: `This number is a ${elevated} account. Please sign in from ${PORTALS[elevated]}.`,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, allowed: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    // Never hard-fail the login screen: if the backend is momentarily
    // unavailable (restart/upgrade), fall through and let signIn decide.
    console.error("eligibility check failed:", e);
    return new Response(
      JSON.stringify({
        ok: false,
        allowed: true,
        degraded: true,
        error: (e as Error)?.message ?? String(e),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

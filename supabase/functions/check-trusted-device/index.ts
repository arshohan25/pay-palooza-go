import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PORTALS = ["user", "merchant", "agent", "distributor", "super_distributor"] as const;
type Portal = typeof PORTALS[number];

const PHONE_REGEX = /^01[3-9]\d{8}$/;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input.replace(/\D/g, "").replace(/^88/, "");
  return PHONE_REGEX.test(cleaned) ? cleaned : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const phone = normalizePhone(body?.phone);
  const device_fp = typeof body?.device_fp === "string" ? body.device_fp.trim() : "";
  const portal = body?.portal as Portal;

  if (!phone) return json(400, { error: "Invalid phone" });
  if (device_fp.length < 16) return json(400, { error: "Invalid device fingerprint" });
  if (!PORTALS.includes(portal)) return json(400, { error: "Invalid portal" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Resolve user_id from phone (profiles.phone)
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (!profile) {
    // Don't leak existence — just say not trusted.
    return json(200, { trusted: false });
  }

  const { data: row } = await admin
    .from("trusted_devices")
    .select("id")
    .eq("user_id", profile.id)
    .eq("device_fp", device_fp)
    .eq("portal", portal)
    .maybeSingle();

  return json(200, { trusted: !!row });
});

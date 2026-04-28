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

  // Require an authenticated caller (user JWT) — we trust the JWT, not the body.
  const authHeader = req.headers.get("Authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) return json(401, { error: "Missing auth" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: "Invalid session" });
  const user_id = userData.user.id;

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

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Upsert (user, device_fp, portal) — bumps last_seen_at if present.
  const { error } = await admin
    .from("trusted_devices")
    .upsert(
      { user_id, phone, device_fp, portal, last_seen_at: new Date().toISOString() },
      { onConflict: "user_id,device_fp,portal" },
    );

  if (error) {
    console.error("mark-trusted-device upsert failed", error);
    return json(500, { error: "Failed to mark device" });
  }

  return json(200, { ok: true });
});

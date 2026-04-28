// Validates a server-issued device trust token for (phone, device_fp, portal).
// No user JWT required — the token itself proves trust.
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

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }

  const phone = normalizePhone(body?.phone);
  const device_fp = typeof body?.device_fp === "string" ? body.device_fp.trim() : "";
  const portal = body?.portal as Portal;
  const token = typeof body?.token === "string" ? body.token.trim() : "";

  if (!phone) return json(400, { error: "Invalid phone" });
  if (device_fp.length < 16) return json(400, { error: "Invalid device fingerprint" });
  if (!PORTALS.includes(portal)) return json(400, { error: "Invalid portal" });
  if (token.length < 32) return json(400, { error: "Invalid token" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await admin
    .from("profiles").select("id").eq("phone", phone).maybeSingle();
  if (!profile) return json(200, { trusted: false });

  const token_hash = await sha256Hex(token);

  const { data: row } = await admin
    .from("trusted_devices")
    .select("id, token_expires_at, revoked_at")
    .eq("user_id", profile.id)
    .eq("device_fp", device_fp)
    .eq("portal", portal)
    .eq("token_hash", token_hash)
    .maybeSingle();

  if (!row) return json(200, { trusted: false });
  if (row.revoked_at) return json(200, { trusted: false, reason: "revoked" });
  if (row.token_expires_at && new Date(row.token_expires_at) < new Date()) {
    return json(200, { trusted: false, reason: "expired" });
  }

  // Bump last_seen_at (best effort)
  admin.from("trusted_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", row.id)
    .then(() => {});

  return json(200, { trusted: true, user_id: profile.id });
});

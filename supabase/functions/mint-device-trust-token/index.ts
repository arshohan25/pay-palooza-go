// Mints a device trust token for the authenticated user, bound to (user, device_fp, portal).
// Requires the caller to have just successfully verified an OTP for the same purpose:
// the OTP ticket is consumed here.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TICKET_SECRET = Deno.env.get("OTP_TICKET_SECRET") || SUPABASE_SERVICE_ROLE_KEY;
const PORTALS = ["user", "merchant", "agent", "distributor", "super_distributor"] as const;
const PHONE_REGEX = /^01[3-9]\d{8}$/;
const TTL_DAYS = 90;

function json(s: number, b: unknown) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function normalizePhone(i: unknown): string | null {
  if (typeof i !== "string") return null;
  const c = i.replace(/\D/g, "").replace(/^88/, "");
  return PHONE_REGEX.test(c) ? c : null;
}
async function sha256Hex(s: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hmacSha256B64Url(key: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecodeJson(s: string): any {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return JSON.parse(atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad));
}
function randomToken(): string {
  const a = new Uint8Array(32); crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const auth = req.headers.get("Authorization") || "";
  const accessToken = auth.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) return json(401, { error: "Missing auth" });

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: u, error: uerr } = await userClient.auth.getUser();
  if (uerr || !u?.user) return json(401, { error: "Invalid session" });
  const user_id = u.user.id;

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  const phone = normalizePhone(body?.phone);
  const device_fp = typeof body?.device_fp === "string" ? body.device_fp.trim() : "";
  const portal = body?.portal;
  const otp_ticket = typeof body?.otp_ticket === "string" ? body.otp_ticket.trim() : "";
  if (!phone) return json(400, { error: "Invalid phone" });
  if (device_fp.length < 16) return json(400, { error: "Invalid device fingerprint" });
  if (!PORTALS.includes(portal)) return json(400, { error: "Invalid portal" });
  if (!otp_ticket) return json(400, { error: "OTP ticket required" });

  // Validate ticket signature
  const parts = otp_ticket.split(".");
  if (parts.length !== 2) return json(400, { error: "Invalid ticket" });
  const [payloadB64, sig] = parts;
  const expected = await hmacSha256B64Url(TICKET_SECRET, payloadB64);
  if (sig.length !== expected.length) return json(400, { error: "Invalid ticket" });
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return json(400, { error: "Invalid ticket" });
  let payload: any;
  try { payload = b64urlDecodeJson(payloadB64); } catch { return json(400, { error: "Invalid ticket" }); }
  if (payload.phone !== phone || payload.portal !== portal) return json(400, { error: "Ticket mismatch" });
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return json(400, { error: "Ticket expired" });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Burn the ticket (replay protection)
  const { error: burnErr } = await admin.from("otp_tickets_used").insert({
    jti: payload.jti, phone, portal,
    expires_at: new Date(payload.exp * 1000).toISOString(),
  });
  if (burnErr) return json(400, { error: "Ticket already used" });

  // Mint and persist trust token
  const token = randomToken();
  const token_hash = await sha256Hex(token);
  const expires_at = new Date(Date.now() + TTL_DAYS * 86400 * 1000).toISOString();
  const { error: upErr } = await admin.from("trusted_devices").upsert(
    {
      user_id, phone, device_fp, portal,
      token_hash, token_expires_at: expires_at, revoked_at: null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,device_fp,portal" },
  );
  if (upErr) {
    console.error("trusted_devices upsert failed", upErr);
    return json(500, { error: "Failed to persist trust" });
  }

  return json(200, { ok: true, device_token: token, device_token_expires_at: expires_at });
});

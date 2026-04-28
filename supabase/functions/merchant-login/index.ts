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
const TRUST_TOKEN_TTL_DAYS = 90;

const PHONE_REGEX = /^01[3-9]\d{8}$/;
const PIN_REGEX = /^\d{4}$/;
const PRIMARY_DOMAIN = "easypay.app";
const FALLBACK_DOMAINS = ["example.com", "easypay.local"];
const PORTAL = "merchant";

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

function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || null;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256B64Url(key: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(msg));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecodeJson(s: string): any {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return JSON.parse(atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad));
}

function randomTokenB64Url(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function validateDeviceToken(
  admin: ReturnType<typeof createClient>,
  user_id: string,
  device_fp: string,
  token: string,
): Promise<boolean> {
  const token_hash = await sha256Hex(token);
  const { data: row } = await admin
    .from("trusted_devices")
    .select("id, token_expires_at, revoked_at")
    .eq("user_id", user_id)
    .eq("device_fp", device_fp)
    .eq("portal", PORTAL)
    .eq("token_hash", token_hash)
    .maybeSingle();
  if (!row || row.revoked_at) return false;
  if (row.token_expires_at && new Date(row.token_expires_at) < new Date()) return false;
  admin.from("trusted_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", row.id).then(() => {});
  return true;
}

async function consumeOtpTicket(
  admin: ReturnType<typeof createClient>,
  ticket: string,
  expectedPhone: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const parts = ticket.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [payloadB64, sig] = parts;
  const expectedSig = await hmacSha256B64Url(TICKET_SECRET, payloadB64);
  if (sig.length !== expectedSig.length) return { ok: false, reason: "bad_sig" };
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  if (diff !== 0) return { ok: false, reason: "bad_sig" };

  let payload: any;
  try { payload = b64urlDecodeJson(payloadB64); } catch { return { ok: false, reason: "malformed" }; }
  if (!payload?.jti || payload.phone !== expectedPhone || payload.portal !== PORTAL) {
    return { ok: false, reason: "mismatch" };
  }
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const { error: burnErr } = await admin
    .from("otp_tickets_used")
    .insert({
      jti: payload.jti,
      phone: expectedPhone,
      portal: PORTAL,
      expires_at: new Date(payload.exp * 1000).toISOString(),
    });
  if (burnErr) return { ok: false, reason: "replayed" };
  return { ok: true };
}

async function issueDeviceTrustToken(
  admin: ReturnType<typeof createClient>,
  user_id: string,
  phone: string,
  device_fp: string,
): Promise<{ token: string; expires_at: string }> {
  const token = randomTokenB64Url(32);
  const token_hash = await sha256Hex(token);
  const expires_at = new Date(Date.now() + TRUST_TOKEN_TTL_DAYS * 86400 * 1000).toISOString();
  await admin.from("trusted_devices").upsert(
    {
      user_id, phone, device_fp, portal: PORTAL,
      token_hash, token_expires_at: expires_at, revoked_at: null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,device_fp,portal" },
  );
  return { token, expires_at };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, message: "Method not allowed" });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: any;
  try { body = await req.json(); } catch {
    return json(400, { ok: false, message: "Invalid JSON body" });
  }

  const phone = normalizePhone(body?.phone);
  const pin = typeof body?.pin === "string" ? body.pin : "";
  const device_fp = typeof body?.device_fp === "string" ? body.device_fp.trim() : "";
  const device_token = typeof body?.device_token === "string" ? body.device_token.trim() : "";
  const otp_ticket = typeof body?.otp_ticket === "string" ? body.otp_ticket.trim() : "";
  const mode: "owner" | "staff" = body?.mode === "staff" ? "staff" : "owner";

  if (!phone) {
    return json(400, { ok: false, message: "Enter a valid 11-digit Bangladeshi mobile number." });
  }
  if (!PIN_REGEX.test(pin)) {
    return json(400, { ok: false, message: "Enter your 4-digit PIN." });
  }
  if (device_fp.length < 16) {
    return json(400, { ok: false, message: "Device verification required." });
  }

  const ip = getClientIp(req);

  // 1. Lockout check
  const { data: lockData, error: lockErr } = await admin.rpc(
    "check_merchant_login_lockout", { p_phone: phone },
  );
  if (lockErr) {
    console.error("lockout check failed", lockErr);
    return json(500, { ok: false, message: "Login service unavailable" });
  }
  const lock = lockData as { locked: boolean; attempts_remaining: number; retry_after_seconds: number };
  if (lock?.locked) {
    const minutes = Math.ceil(lock.retry_after_seconds / 60);
    return new Response(JSON.stringify({
      ok: false, locked: true, attempts_remaining: 0,
      retry_after_seconds: lock.retry_after_seconds,
      message: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(lock.retry_after_seconds) } });
  }

  // 2. PIN auth (no session returned to client until device verified)
  const password = `${pin}EP`;
  const candidateEmails = [
    `${phone}@${PRIMARY_DOMAIN}`,
    ...FALLBACK_DOMAINS.map((d) => `${phone}@${d}`),
  ];

  let session: any = null;
  let user: any = null;

  for (const email of candidateEmails) {
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });
    if (!error && data?.session && data?.user) {
      session = data.session;
      user = data.user;
      break;
    }
    if (error?.message?.includes("Invalid login credentials")) continue;
    if (error) {
      console.error("auth error", error);
      return json(500, { ok: false, message: "Login service unavailable" });
    }
  }

  if (!session || !user) {
    await admin.from("merchant_login_attempts").insert({ phone, ip, success: false });
    admin.rpc("purge_old_merchant_login_attempts").then(() => {});
    const { data: postLock } = await admin.rpc("check_merchant_login_lockout", { p_phone: phone });
    const pl = postLock as { locked: boolean; attempts_remaining: number; retry_after_seconds: number } | null;
    if (pl?.locked) {
      const minutes = Math.ceil(pl.retry_after_seconds / 60);
      return new Response(JSON.stringify({
        ok: false, locked: true, attempts_remaining: 0,
        retry_after_seconds: pl.retry_after_seconds,
        message: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(pl.retry_after_seconds) } });
    }
    return json(401, { ok: false, locked: false, attempts_remaining: pl?.attempts_remaining ?? null, message: "Wrong phone or PIN" });
  }

  // 3. Merchant role check
  const { data: roles, error: roleErr } = await admin
    .from("user_roles").select("role").eq("user_id", user.id);
  if (roleErr) {
    console.error("role lookup failed", roleErr);
    return json(500, { ok: false, message: "Login service unavailable" });
  }
  const roleNames = (roles ?? []).map((r: any) => r.role);
  if (!(roleNames.includes("merchant") || roleNames.includes("admin"))) {
    return json(403, { ok: false, locked: false, message: "This account isn't a merchant account" });
  }

  // 4. DEVICE GATE — withhold session tokens until device is proven trusted
  let deviceTrusted = false;
  let issuedTrust: { token: string; expires_at: string } | null = null;

  if (device_token) {
    deviceTrusted = await validateDeviceToken(admin, user.id, device_fp, device_token);
  }

  if (!deviceTrusted && otp_ticket) {
    const result = await consumeOtpTicket(admin, otp_ticket, phone);
    if (result.ok) {
      deviceTrusted = true;
      issuedTrust = await issueDeviceTrustToken(admin, user.id, phone, device_fp);
    }
  }

  if (!deviceTrusted) {
    // Credentials valid but device not verified. Don't count as failed attempt.
    return json(200, {
      ok: true,
      requires_device_verification: true,
      otp_required: true,
      message: "Device verification required",
    });
  }

  // 5. Success — clear failed attempts, log success, return session
  await admin.from("merchant_login_attempts").delete().eq("phone", phone).eq("success", false);
  await admin.from("merchant_login_attempts").insert({ phone, ip, success: true });

  return json(200, {
    ok: true,
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
      token_type: session.token_type,
    },
    user: { id: user.id },
    device_verified: true,
    device_token: issuedTrust?.token ?? null,
    device_token_expires_at: issuedTrust?.expires_at ?? null,
  });
});

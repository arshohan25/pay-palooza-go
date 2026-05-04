import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TICKET_SECRET = Deno.env.get("OTP_TICKET_SECRET") || SUPABASE_SERVICE_ROLE_KEY || "fallback-dev-secret";

const TICKET_EXTEND_S = 30 * 60; // refresh ticket to 30 min on every successful fetch

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacSha256B64Url(key: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlEncode(obj: unknown): string {
  const j = JSON.stringify(obj);
  return btoa(j).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecodeJson(b64: string): any | null {
  try {
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const std = b64.replace(/-/g, "+").replace(/_/g, "/") + pad;
    return JSON.parse(atob(std));
  } catch { return null; }
}

async function verifyTicket(ticket: string): Promise<{ phone: string } | null> {
  const [payloadB64, sig] = ticket.split(".");
  if (!payloadB64 || !sig) return null;
  const expected = await hmacSha256B64Url(TICKET_SECRET, payloadB64);
  if (expected !== sig) return null;
  const payload = b64urlDecodeJson(payloadB64);
  if (!payload) return null;
  if (payload.purpose !== "merchant_pin_reset") return null;
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
  if (typeof payload.phone !== "string") return null;
  return { phone: payload.phone };
}

async function mintTicket(phone: string): Promise<{ ticket: string; exp: number }> {
  const exp = Math.floor(Date.now() / 1000) + TICKET_EXTEND_S;
  const payload = {
    jti: crypto.randomUUID(),
    phone,
    portal: "merchant_pin_reset",
    purpose: "merchant_pin_reset",
    exp,
  };
  const payloadB64 = b64urlEncode(payload);
  const sig = await hmacSha256B64Url(TICKET_SECRET, payloadB64);
  return { ticket: `${payloadB64}.${sig}`, exp };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, message: "Method not allowed" });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { ok: false, message: "Invalid request" }); }

  const action = body?.action;
  const requestId = body?.request_id;
  const otpTicket = body?.otp_ticket;

  if (!requestId || typeof requestId !== "string") return json(400, { ok: false, message: "Missing request_id" });
  if (!otpTicket || typeof otpTicket !== "string") return json(401, { ok: false, message: "Missing ticket" });

  const verified = await verifyTicket(otpTicket);
  if (!verified) return json(401, { ok: false, message: "Ticket expired. Please verify your number again." });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Validate the ticket phone matches the request
  const { data: requestRow, error: reqErr } = await admin
    .from("merchant_pin_reset_requests")
    .select("id, phone, status")
    .eq("id", requestId)
    .maybeSingle();

  if (reqErr || !requestRow) return json(404, { ok: false, message: "Ticket not found" });
  if (requestRow.phone !== verified.phone) return json(403, { ok: false, message: "Phone mismatch" });

  if (action === "fetch") {
    const { data: messages, error: mErr } = await admin
      .from("merchant_pin_reset_messages")
      .select("id, request_id, sender_role, content, created_at, read_by_admin, read_by_merchant")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });
    if (mErr) return json(500, { ok: false, message: "Couldn't load messages" });

    // Mark admin messages as read by merchant
    await admin
      .from("merchant_pin_reset_messages")
      .update({ read_by_merchant: true })
      .eq("request_id", requestId)
      .eq("sender_role", "admin")
      .eq("read_by_merchant", false);

    const fresh = await mintTicket(verified.phone);
    return json(200, {
      ok: true,
      messages: messages ?? [],
      status: requestRow.status,
      otp_ticket: fresh.ticket,
      otp_ticket_expires_at: new Date(fresh.exp * 1000).toISOString(),
    });
  }

  if (action === "send") {
    if (requestRow.status !== "open") {
      return json(409, { ok: false, message: "This ticket is closed." });
    }
    const text = typeof body?.content === "string" ? body.content.trim().slice(0, 2000) : "";
    if (!text) return json(400, { ok: false, message: "Message can't be empty" });

    const { data: inserted, error: insErr } = await admin
      .from("merchant_pin_reset_messages")
      .insert({
        request_id: requestId,
        sender_role: "merchant",
        content: text,
        read_by_admin: false,
        read_by_merchant: true,
      })
      .select("id, request_id, sender_role, content, created_at, read_by_admin, read_by_merchant")
      .single();
    if (insErr || !inserted) return json(500, { ok: false, message: "Couldn't send message" });

    const fresh = await mintTicket(verified.phone);
    return json(200, {
      ok: true,
      message: inserted,
      otp_ticket: fresh.ticket,
      otp_ticket_expires_at: new Date(fresh.exp * 1000).toISOString(),
    });
  }

  if (action === "ack") {
    await admin
      .from("merchant_pin_reset_messages")
      .update({ read_by_merchant: true })
      .eq("request_id", requestId)
      .eq("sender_role", "admin")
      .eq("read_by_merchant", false);
    return json(200, { ok: true });
  }

  return json(400, { ok: false, message: "Unknown action" });
});

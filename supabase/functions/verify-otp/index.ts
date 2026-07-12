import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TICKET_SECRET = Deno.env.get("OTP_TICKET_SECRET") ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "fallback-dev-secret";

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
  const json = JSON.stringify(obj);
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { phone, code, purpose } = await req.json();

    if (!phone || !/^01[3-9]\d{8}$/.test(phone)) {
      return new Response(JSON.stringify({ error: "Invalid phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!code || code.length !== 6) {
      return new Response(JSON.stringify({ error: "Invalid OTP code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const validPurpose = purpose || "pin_reset";
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Brute-force protection for pin_reset OTPs ─────────────────────────
    // Track failed verifications via pin_reset_attempts. Lock after 5 failed
    // attempts within a 15-minute rolling window.
    const RATE_LIMITED_PURPOSES = new Set(["pin_reset"]);
    const MAX_FAILED_ATTEMPTS = 5;
    const LOCKOUT_WINDOW_MINUTES = 15;
    const rateLimited = RATE_LIMITED_PURPOSES.has(validPurpose);
    if (rateLimited) {
      const windowStart = new Date(
        Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000,
      ).toISOString();
      const { count: failedCount } = await supabaseAdmin
        .from("pin_reset_attempts")
        .select("*", { count: "exact", head: true })
        .eq("phone", phone)
        .eq("success", false)
        .gte("attempted_at", windowStart);
      if ((failedCount ?? 0) >= MAX_FAILED_ATTEMPTS) {
        return new Response(
          JSON.stringify({
            verified: false,
            locked: true,
            error: `Too many failed attempts. Try again in ${LOCKOUT_WINDOW_MINUTES} minutes.`,
            retry_after_minutes: LOCKOUT_WINDOW_MINUTES,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const recordFailure = async () => {
      if (!rateLimited) return;
      await supabaseAdmin
        .from("pin_reset_attempts")
        .insert({ phone, success: false });
    };

    const { data: otpRecord, error: fetchError } = await supabaseAdmin
      .from("otp_codes")
      .select("id, code, expires_at")
      .eq("phone", phone)
      .eq("purpose", validPurpose)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!otpRecord) {
      await recordFailure();
      return new Response(JSON.stringify({ verified: false, error: "No pending OTP found. Please request again." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (new Date(otpRecord.expires_at) < new Date()) {
      await recordFailure();
      return new Response(JSON.stringify({ verified: false, error: "OTP has expired. Please request a new one." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (otpRecord.code !== code) {
      await recordFailure();
      return new Response(JSON.stringify({ verified: false, error: "Incorrect OTP code." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    await supabaseAdmin.from("otp_codes").update({ verified: true }).eq("id", otpRecord.id);

    // Mint a single-use OTP ticket for device-verification or merchant PIN reset.
    let otp_ticket: string | null = null;
    let otp_ticket_expires_at: string | null = null;
    const issuesTicket =
      typeof validPurpose === "string" &&
      (validPurpose.startsWith("device_verify_") || validPurpose === "merchant_pin_reset");
    if (issuesTicket) {
      const portal = validPurpose.startsWith("device_verify_")
        ? validPurpose.replace(/^device_verify_/, "")
        : "merchant_pin_reset";
      const jti = crypto.randomUUID();
      // Device-verify tickets are short-lived (2 min). Merchant PIN-reset tickets
      // are reused by the guest live-chat thread, so they need a longer life (30 min).
      const ttlSeconds = validPurpose === "merchant_pin_reset" ? 30 * 60 : 120;
      const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
      const payload = { jti, phone, portal, exp, purpose: validPurpose };
      const payloadB64 = b64urlEncode(payload);
      const sig = await hmacSha256B64Url(TICKET_SECRET, payloadB64);
      otp_ticket = `${payloadB64}.${sig}`;
      otp_ticket_expires_at = new Date(exp * 1000).toISOString();
    }

    return new Response(
      JSON.stringify({
        verified: true,
        message: "OTP verified successfully.",
        otp_ticket,
        otp_ticket_expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("verify-otp error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

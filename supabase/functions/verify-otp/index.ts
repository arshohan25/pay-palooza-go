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
      return new Response(JSON.stringify({ verified: false, error: "No pending OTP found. Please request again." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (new Date(otpRecord.expires_at) < new Date()) {
      return new Response(JSON.stringify({ verified: false, error: "OTP has expired. Please request a new one." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (otpRecord.code !== code) {
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
      const exp = Math.floor(Date.now() / 1000) + 120; // 2 min
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

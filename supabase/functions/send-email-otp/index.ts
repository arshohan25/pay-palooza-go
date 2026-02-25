import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_PER_HOUR = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { email, action, code } = body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─── VERIFY OTP ───
    if (action === "verify") {
      if (!code || typeof code !== "string" || code.length !== 6) {
        return new Response(
          JSON.stringify({ error: "Invalid OTP code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: otpRecord } = await supabaseAdmin
        .from("otp_codes")
        .select("*")
        .eq("phone", email)
        .eq("purpose", "email_verify")
        .eq("code", code)
        .eq("verified", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otpRecord) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired OTP" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark as verified
      await supabaseAdmin
        .from("otp_codes")
        .update({ verified: true })
        .eq("id", otpRecord.id);

      return new Response(
        JSON.stringify({ success: true, verified: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── SEND OTP ───
    // Rate limit
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("otp_codes")
      .select("*", { count: "exact", head: true })
      .eq("phone", email)
      .eq("purpose", "email_verify")
      .gte("created_at", windowStart);

    if ((count ?? 0) >= MAX_OTP_PER_HOUR) {
      return new Response(
        JSON.stringify({ error: "Too many OTP requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invalidate previous OTPs
    await supabaseAdmin
      .from("otp_codes")
      .update({ verified: true })
      .eq("phone", email)
      .eq("purpose", "email_verify")
      .eq("verified", false);

    // Generate 6-digit OTP
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    await supabaseAdmin.from("otp_codes").insert({
      phone: email,
      code: otpCode,
      purpose: "email_verify",
      expires_at: expiresAt,
    });

    console.log(`[DEV] Email OTP for ${email}: ${otpCode}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "OTP sent to your email.",
        dev_otp: otpCode, // DEV ONLY - remove in production
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-email-otp error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_PER_HOUR = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone, purpose } = await req.json();

    if (!phone || !/^01[3-9]\d{8}$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ALLOWED_PURPOSES = new Set([
      "pin_reset",
      "merchant_pin_reset",
      "payment",
      "agent_register",
      "device_verify_user",
      "device_verify_merchant",
      "device_verify_agent",
      "device_verify_distributor",
      "device_verify_super_distributor",
    ]);
    const validPurpose = (typeof purpose === "string" && ALLOWED_PURPOSES.has(purpose))
      ? purpose
      : "pin_reset";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Rate limit: max OTPs per hour
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("otp_codes")
      .select("*", { count: "exact", head: true })
      .eq("phone", phone)
      .eq("purpose", validPurpose)
      .gte("created_at", windowStart);

    if ((count ?? 0) >= MAX_OTP_PER_HOUR) {
      return new Response(
        JSON.stringify({ error: "Too many OTP requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check phone is registered (for pin_reset and payment purposes, skip for agent_register)
    if (validPurpose === "pin_reset" || validPurpose === "payment") {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();

      if (!profile) {
        // Generic message to prevent enumeration
        return new Response(
          JSON.stringify({ success: true, message: "If this number is registered, an OTP has been sent." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Invalidate previous unused OTPs
    await supabaseAdmin
      .from("otp_codes")
      .update({ verified: true })
      .eq("phone", phone)
      .eq("purpose", validPurpose)
      .eq("verified", false);

    // Generate 6-digit OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    await supabaseAdmin.from("otp_codes").insert({
      phone,
      code,
      purpose: validPurpose,
      expires_at: expiresAt,
    });

    // --- DEV MODE: Log OTP to function logs (replace with SMS API in production) ---
    console.log(`[DEV] OTP for ${phone}: ${code}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "OTP sent successfully.",
        // DEV ONLY: return code for testing. Remove in production!
        dev_otp: code,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-otp error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

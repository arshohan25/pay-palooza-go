import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 3;
const WINDOW_MINUTES = 60;
const OTP_EXPIRY_MINUTES = 5;

function generateOtp(): string {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── ACTION: send-otp ─────────────────────────────────────────────────────
    if (action === "send-otp") {
      const { phone } = body;

      if (!phone || !/^01[3-9]\d{8}$/.test(phone)) {
        return new Response(
          JSON.stringify({ error: "Invalid phone number" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Rate limiting on OTP sends
      const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
      const { count: attemptCount } = await supabaseAdmin
        .from("pin_reset_attempts")
        .select("*", { count: "exact", head: true })
        .eq("phone", phone)
        .gte("attempted_at", windowStart);

      if ((attemptCount ?? 0) >= MAX_ATTEMPTS) {
        return new Response(
          JSON.stringify({ error: "Too many attempts. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if phone exists (generic error to prevent enumeration)
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("phone", phone)
        .maybeSingle();

      if (!profile) {
        // Don't reveal that the phone doesn't exist — still return success
        return new Response(
          JSON.stringify({ success: true, message: "OTP sent if number is registered." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate OTP
      const code = generateOtp();

      // Delete old OTPs for this phone
      await supabaseAdmin
        .from("otp_codes")
        .delete()
        .eq("phone", phone)
        .eq("purpose", "pin_reset");

      // Store OTP
      await supabaseAdmin.from("otp_codes").insert({
        phone,
        code,
        purpose: "pin_reset",
        expires_at: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString(),
      });

      // Record attempt
      await supabaseAdmin.from("pin_reset_attempts").insert({ phone, success: false });

      // TODO: In production, send SMS via Twilio/Vonage here
      // For dev mode, we return the OTP in the response (will be shown as toast)
      console.log(`[DEV] OTP for ${phone}: ${code}`);

      return new Response(
        JSON.stringify({ success: true, message: "OTP sent if number is registered.", dev_otp: code }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ACTION: verify-otp-and-reset ─────────────────────────────────────────
    if (action === "verify-otp-and-reset") {
      const { phone, otp, newPin } = body;

      if (!phone || !/^01[3-9]\d{8}$/.test(phone)) {
        return new Response(
          JSON.stringify({ error: "Invalid phone number" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!otp || !/^\d{6}$/.test(otp)) {
        return new Response(
          JSON.stringify({ error: "Invalid OTP format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!newPin || !/^\d{4}$/.test(newPin)) {
        return new Response(
          JSON.stringify({ error: "PIN must be 4 digits" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Reject weak PINs
      const SEQUENTIAL = ["0123","1234","2345","3456","4567","5678","6789","9876","8765","7654","6543","5432","4321","3210"];
      const REPEATED = ["0000","1111","2222","3333","4444","5555","6666","7777","8888","9999"];
      if (SEQUENTIAL.includes(newPin) || REPEATED.includes(newPin)) {
        return new Response(
          JSON.stringify({ error: "PIN is too weak. Avoid sequential or repeated digits." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find valid OTP
      const { data: otpRecord } = await supabaseAdmin
        .from("otp_codes")
        .select("*")
        .eq("phone", phone)
        .eq("purpose", "pin_reset")
        .eq("code", otp)
        .eq("verified", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otpRecord) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired OTP. Please request a new one." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark OTP as verified
      await supabaseAdmin
        .from("otp_codes")
        .update({ verified: true })
        .eq("id", otpRecord.id);

      // Find user profile
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("phone", phone)
        .maybeSingle();

      if (!profile) {
        return new Response(
          JSON.stringify({ error: "Verification failed. Please check your details." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Reset password
      const password = `${newPin}EP`;
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        profile.user_id,
        { password }
      );

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to reset PIN. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Clean up OTPs for this phone
      await supabaseAdmin
        .from("otp_codes")
        .delete()
        .eq("phone", phone)
        .eq("purpose", "pin_reset");

      // Mark attempt as successful
      await supabaseAdmin
        .from("pin_reset_attempts")
        .update({ success: true })
        .eq("phone", phone)
        .order("attempted_at", { ascending: false })
        .limit(1);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Legacy support: old format without action field ──────────────────────
    // If no action field, treat as old balance/txn verification (backward compat)
    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'send-otp' or 'verify-otp-and-reset'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

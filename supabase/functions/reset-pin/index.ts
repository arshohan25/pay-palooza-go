import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 3;
const WINDOW_MINUTES = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone, newPin, otpCode } = await req.json();

    // Validate inputs
    if (!phone || !newPin || !otpCode) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!/^01[3-9]\d{8}$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!/^\d{4}$/.test(newPin)) {
      return new Response(
        JSON.stringify({ error: "PIN must be 4 digits" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!/^\d{6}$/.test(otpCode)) {
      return new Response(
        JSON.stringify({ error: "OTP must be 6 digits" }),
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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // --- Rate limiting check ---
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

    // Record this attempt
    await supabaseAdmin.from("pin_reset_attempts").insert({ phone, success: false });

    // Verify OTP code
    const { data: otpRecord, error: otpError } = await supabaseAdmin
      .from("otp_codes")
      .select("id, expires_at")
      .eq("phone", phone)
      .eq("code", otpCode)
      .eq("purpose", "pin_reset")
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError || !otpRecord) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired OTP. Please request a new one." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "OTP has expired. Please request a new one." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark OTP as used
    await supabaseAdmin
      .from("otp_codes")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    // Find user profile by phone
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("phone", phone)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Account not found." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reset password using admin API
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
  } catch (err) {
    console.error("reset-pin error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

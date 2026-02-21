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
    const { phone, newPin, verificationType, verificationValue } = await req.json();

    // Validate inputs
    if (!phone || !newPin || !verificationType || verificationValue === undefined) {
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

    // Create admin client
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

    // Find user profile by phone — use generic error to prevent enumeration
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, balance")
      .eq("phone", phone)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Verification failed. Please check your details." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify identity
    if (verificationType === "balance") {
      const inputBalance = parseFloat(verificationValue);
      const actualBalance = parseFloat(String(profile.balance));
      if (isNaN(inputBalance) || Math.abs(inputBalance - actualBalance) > 0.01) {
        return new Response(
          JSON.stringify({ error: "Verification failed. Please check your details." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (verificationType === "lastTransaction") {
      const { data: lastTxn } = await supabaseAdmin
        .from("transactions")
        .select("amount")
        .eq("user_id", profile.user_id)
        .in("type", ["send", "cashout", "payment", "recharge", "paybill"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastTxn) {
        return new Response(
          JSON.stringify({ error: "Verification failed. Please check your details." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const inputAmount = parseFloat(verificationValue);
      const actualAmount = parseFloat(String(lastTxn.amount));
      if (isNaN(inputAmount) || Math.abs(inputAmount - actualAmount) > 0.01) {
        return new Response(
          JSON.stringify({ error: "Verification failed. Please check your details." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid verification type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Identity verified — reset password using admin API
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
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

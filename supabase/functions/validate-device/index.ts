import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { device_fingerprint, user_id } = await req.json();

    if (!device_fingerprint || typeof device_fingerprint !== "string" || device_fingerprint.length < 16) {
      return new Response(
        JSON.stringify({ error: "Invalid device fingerprint" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!user_id || typeof user_id !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid user ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if device fingerprint already registered to a different user
    const { data: existing } = await supabaseAdmin
      .from("device_registrations")
      .select("user_id")
      .eq("device_fingerprint", device_fingerprint)
      .maybeSingle();

    if (existing && existing.user_id !== user_id) {
      return new Response(
        JSON.stringify({
          allowed: false,
          error: "This device already has an account. Only one account per device is allowed.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If not registered yet, register the device
    if (!existing) {
      const { error: insertErr } = await supabaseAdmin
        .from("device_registrations")
        .insert({ device_fingerprint, user_id });

      if (insertErr) {
        // Could be a race condition duplicate - check again
        if (insertErr.code === "23505") {
          return new Response(
            JSON.stringify({
              allowed: false,
              error: "This device already has an account.",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw insertErr;
      }
    }

    return new Response(
      JSON.stringify({ allowed: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("validate-device error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

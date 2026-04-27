import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Standardized admin-authz error contract shared across threshold-related
 * Edge Functions. Always returns:
 *   { error: { code, message } }
 * with stable HTTP status (401 UNAUTHORIZED, 403 FORBIDDEN_ADMIN_REQUIRED).
 */
function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError(401, "UNAUTHORIZED", "Unauthorized");
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser(token);
    if (userErr || !user) {
      return jsonError(401, "UNAUTHORIZED", "Unauthorized");
    }

    const userId = user.id;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return jsonError(403, "FORBIDDEN_ADMIN_REQUIRED", "Forbidden: admin role required");
    }

    // Check which secrets are configured (boolean only, no values exposed)
    const secretChecks: Record<string, boolean> = {
      twilio_account_sid: !!Deno.env.get("TWILIO_ACCOUNT_SID"),
      twilio_auth_token: !!Deno.env.get("TWILIO_AUTH_TOKEN"),
      twilio_phone_number: !!Deno.env.get("TWILIO_PHONE_NUMBER"),
      resend_api_key: !!Deno.env.get("RESEND_API_KEY"),
    };

    // Derive service-level status
    const services: Record<string, boolean> = {
      sms: secretChecks.twilio_account_sid && secretChecks.twilio_auth_token && secretChecks.twilio_phone_number,
      email: secretChecks.resend_api_key,
      kyc_ocr: true,       // Edge function always available
      kyc_face_match: true, // Edge function always available
      otp: true,            // Edge function always available
      device_validation: true, // Edge function always available
    };

    return new Response(JSON.stringify({ services }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("check-api-status error:", err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
});

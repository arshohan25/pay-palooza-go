// DEPRECATED: This endpoint previously upserted a trusted_devices row based only on a
// valid user JWT + a client-supplied phone number, without proving OTP ownership of that
// phone. That allowed a signed-in user to mark any phone as a "trusted device" for
// themselves, which could bypass device/OTP checks anywhere trust is inferred by row
// existence. All real callers must go through `mint-device-trust-token`, which requires
// a signed OTP ticket. This endpoint is now disabled and always returns 410.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      error: "This endpoint is deprecated. Use mint-device-trust-token (OTP-verified) instead.",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

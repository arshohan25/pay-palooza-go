// team-login-verify: validate the pre-auth token + email OTP, then mint a real
// Supabase session by generating a magiclink token_hash the client can exchange
// via supabase.auth.verifyOtp. Only this endpoint can produce a usable session
// for team logins — so 2FA is a hard server-side gate, not a UI-only step.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { preAuthToken, code } = await req.json();
    if (typeof preAuthToken !== "string" || typeof code !== "string" || code.length !== 6) {
      return jsonResponse({ error: "Invalid request" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const tokenHash = await sha256Hex(preAuthToken);
    const { data: preAuth } = await admin
      .from("team_pre_auth_tokens")
      .select("id, user_id, email, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!preAuth || preAuth.used_at || new Date(preAuth.expires_at) < new Date()) {
      return jsonResponse({ error: "Session expired. Please sign in again." }, 401);
    }

    const { data: otpRecord } = await admin
      .from("otp_codes")
      .select("id")
      .eq("phone", preAuth.email)
      .eq("purpose", "team_2fa")
      .eq("code", code)
      .eq("verified", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRecord) {
      return jsonResponse({ error: "Invalid or expired code" }, 400);
    }

    // Consume OTP + pre-auth token
    await admin.from("otp_codes").update({ verified: true }).eq("id", otpRecord.id);
    await admin.from("team_pre_auth_tokens").update({ used_at: new Date().toISOString() }).eq("id", preAuth.id);

    // Look up the actual auth user email (synthetic team.easypay.app address)
    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(preAuth.user_id);
    if (userErr || !userData?.user?.email) {
      return jsonResponse({ error: "User not found" }, 500);
    }

    // Generate a magiclink; the returned hashed_token can be exchanged for a
    // full session by the client using supabase.auth.verifyOtp.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email,
    });
    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error("generateLink error", linkErr);
      return jsonResponse({ error: "Failed to issue session" }, 500);
    }

    // Best-effort audit fields on team_members
    try {
      await admin
        .from("team_members")
        .update({
          has_logged_in: true,
          first_login_at: new Date().toISOString(),
        } as any)
        .eq("user_id", preAuth.user_id)
        .is("first_login_at", null);
    } catch (_) { /* ignore */ }

    return jsonResponse({
      success: true,
      tokenHash: linkData.properties.hashed_token,
      email: userData.user.email,
    });
  } catch (err) {
    console.error("team-login-verify error", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

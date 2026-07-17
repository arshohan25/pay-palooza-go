// team-login-start: validate team username+password server-side, immediately
// revoke the resulting session, mint a short-lived pre-auth token, and send an
// email OTP. The real Supabase session is NOT returned here — it is only issued
// by team-login-verify after the OTP is confirmed. This prevents a caller from
// bypassing the 2FA UI by capturing the token from the initial network response.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEAM_EMAIL_DOMAIN = "team.easypay.app";
const OTP_EXPIRY_MIN = 5;
const PRE_AUTH_EXPIRY_MIN = 5;
const MAX_OTP_PER_HOUR = 5;

const normalizeUsername = (u: string) =>
  u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 2)}***@${domain}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { username, password } = await req.json();
    if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password) {
      return jsonResponse({ error: "Username and password are required" }, 400);
    }

    const normalized = normalizeUsername(username);
    if (!normalized) return jsonResponse({ error: "Invalid username" }, 400);
    const email = `${normalized}@${TEAM_EMAIL_DOMAIN}`;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate credentials with a throwaway anon client — this creates a
    // session that we immediately revoke below so the caller never sees it.
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: authData, error: authErr } = await anon.auth.signInWithPassword({ email, password });
    if (authErr || !authData?.user || !authData.session) {
      return jsonResponse({ error: "Invalid credentials" }, 401);
    }

    const userId = authData.user.id;

    // Immediately revoke the session so the returned access_token is useless.
    try {
      await admin.auth.admin.signOut(authData.session.access_token);
    } catch (e) {
      console.error("failed to revoke pre-2fa session", e);
    }

    // Look up team member + real notification email
    const { data: tm } = await admin
      .from("team_members")
      .select("email, has_logged_in, has_changed_password")
      .eq("user_id", userId)
      .maybeSingle();

    if (!tm) {
      // Not a team member — refuse and do not proceed.
      return jsonResponse({ error: "Not authorized as a team member" }, 403);
    }

    const otpEmail = (tm as any).email || email;

    // Rate limit OTPs
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("otp_codes")
      .select("*", { count: "exact", head: true })
      .eq("phone", otpEmail)
      .eq("purpose", "team_2fa")
      .gte("created_at", windowStart);
    if ((count ?? 0) >= MAX_OTP_PER_HOUR) {
      return jsonResponse({ error: "Too many verification requests. Try again later." }, 429);
    }

    // Invalidate previous unverified OTPs for this purpose
    await admin
      .from("otp_codes")
      .update({ verified: true })
      .eq("phone", otpEmail)
      .eq("purpose", "team_2fa")
      .eq("verified", false);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpires = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000).toISOString();
    await admin.from("otp_codes").insert({
      phone: otpEmail,
      code,
      purpose: "team_2fa",
      expires_at: otpExpires,
    });

    // Mint pre-auth token
    const rawToken = crypto.randomUUID() + "." + crypto.randomUUID();
    const tokenHash = await sha256Hex(rawToken);
    const preAuthExpires = new Date(Date.now() + PRE_AUTH_EXPIRY_MIN * 60 * 1000).toISOString();
    const { error: insertErr } = await admin.from("team_pre_auth_tokens").insert({
      token_hash: tokenHash,
      user_id: userId,
      email: otpEmail,
      expires_at: preAuthExpires,
    });
    if (insertErr) {
      console.error("pre-auth token insert failed", insertErr);
      return jsonResponse({ error: "Internal error" }, 500);
    }

    // Send OTP email
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      try {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: "EasyPay <EasyPay@smartshop.bd>",
          to: [otpEmail],
          subject: "Team login verification code",
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
              <h2 style="color:#333;margin-bottom:8px;">Team Login Verification</h2>
              <p style="color:#666;font-size:14px;">Use the code below to complete sign-in. It expires in ${OTP_EXPIRY_MIN} minutes.</p>
              <div style="background:#f4f4f4;border-radius:8px;padding:20px;text-align:center;margin:24px 0;">
                <span style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#333;">${code}</span>
              </div>
              <p style="color:#999;font-size:12px;">If you didn't try to sign in, please change your password immediately.</p>
            </div>`,
        });
      } catch (e) {
        console.error("resend send error", e);
      }
    }

    return jsonResponse({
      success: true,
      preAuthToken: rawToken,
      emailMasked: maskEmail(otpEmail),
      requiresPasswordChange: tm && !(tm as any).has_changed_password ? true : false,
      firstLogin: tm && !(tm as any).has_logged_in ? true : false,
    });
  } catch (err) {
    console.error("team-login-start error", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

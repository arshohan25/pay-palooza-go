import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminId = user.id;

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", adminId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, decision, reviewer_notes } = await req.json();

    if (!user_id || !decision || !["verified", "rejected"].includes(decision)) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile for contact info
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone, email, name")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!profile) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isApproved = decision === "verified";
    const title = isApproved ? "KYC Verified ✅" : "KYC Rejected ❌";
    const body = isApproved
      ? "Your identity verification has been approved. You now have full access to all features."
      : `Your identity verification was not approved.${reviewer_notes ? " Reason: " + reviewer_notes : " Please try again or contact support."}`;

    const results: Record<string, any> = {};

    // 1. In-app notification
    const { error: notifErr } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id,
        title,
        body,
        category: "system",
        metadata: { type: "kyc_decision", decision },
      });
    results.in_app = notifErr ? { error: notifErr.message } : { success: true };

    // 2. Email via Resend
    if (profile.email) {
      try {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (RESEND_API_KEY) {
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "EasyPay <noreply@resend.dev>",
              to: [profile.email],
              subject: isApproved
                ? "Your KYC Verification is Approved"
                : "Your KYC Verification Update",
              html: `
                <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
                  <h2 style="color:${isApproved ? "#16a34a" : "#dc2626"};">
                    ${isApproved ? "✅ KYC Approved" : "❌ KYC Not Approved"}
                  </h2>
                  <p>Dear ${profile.name || "User"},</p>
                  <p>${body}</p>
                  ${!isApproved && reviewer_notes ? `<p style="color:#666;font-size:14px;"><strong>Notes:</strong> ${reviewer_notes}</p>` : ""}
                  <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
                  <p style="color:#999;font-size:12px;">EasyPay — Secure Digital Wallet</p>
                </div>
              `,
            }),
          });
          const emailData = await emailRes.json();
          results.email = emailRes.ok ? { success: true } : { error: emailData };
        } else {
          results.email = { skipped: "RESEND_API_KEY not configured" };
        }
      } catch (e) {
        results.email = { error: e instanceof Error ? e.message : "Email failed" };
      }
    } else {
      results.email = { skipped: "No email on profile" };
    }

    // 3. SMS via Twilio
    if (profile.phone) {
      try {
        const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
        const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
        const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER");

        if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
          // Format BD phone: add +88 if needed
          let phone = profile.phone;
          if (phone.startsWith("01")) phone = "+88" + phone;
          else if (!phone.startsWith("+")) phone = "+" + phone;

          const smsBody = isApproved
            ? `EasyPay: Your KYC verification has been approved! You now have full access.`
            : `EasyPay: Your KYC verification was not approved. ${reviewer_notes ? "Reason: " + reviewer_notes : "Please try again or contact support."}`;

          const formData = new URLSearchParams();
          formData.append("To", phone);
          formData.append("From", TWILIO_FROM);
          formData.append("Body", smsBody);

          const smsRes = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
            {
              method: "POST",
              headers: {
                Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: formData.toString(),
            }
          );
          const smsData = await smsRes.json();
          results.sms = smsRes.ok ? { success: true, sid: smsData.sid } : { error: smsData };
        } else {
          results.sms = { skipped: "Twilio not configured" };
        }
      } catch (e) {
        results.sms = { error: e instanceof Error ? e.message : "SMS failed" };
      }
    } else {
      results.sms = { skipped: "No phone on profile" };
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("kyc-notify error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Sends push notification + email when a merchant's business KYC status
// transitions to approved/rejected. Triggered by a Postgres trigger
// (pg_net) on the merchants table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user_id, merchant_id, status, reason, business_name } = await req.json();
    if (!user_id || !["approved", "rejected"].includes(status)) {
      return new Response(JSON.stringify({ error: "user_id and valid status required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isApproved = status === "approved";
    const biz = (business_name && String(business_name).trim()) || "your business";
    const nextStep = isApproved
      ? "Next: add your bank details & list your first product"
      : "Next: review the feedback and resubmit your application";
    const ctaLabel = isApproved ? "Start Selling" : "Review & Resubmit";
    const ctaUrl = "https://pay-palooza-go.lovable.app/merchant";

    const title = isApproved
      ? `🎉 ${biz} is approved on EasyPay`
      : `Action needed for ${biz}`;
    const body = isApproved
      ? `Your vendor account is live. ${nextStep}.`
      : (reason?.trim()
          ? `Reason: ${reason.trim()}. ${nextStep}.`
          : `${nextStep} in your Merchant dashboard.`);

    const results: Record<string, any> = {};

    // Idempotency guard: skip if we already notified for this merchant+status in last 10 min
    if (merchant_id) {
      const { data: existing } = await sb
        .from("notifications")
        .select("id")
        .eq("user_id", user_id)
        .eq("category", "merchant_ops")
        .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
        .contains("metadata", { type: "merchant_approval", merchant_id, status })
        .maybeSingle();
      if (existing?.id) {
        return new Response(JSON.stringify({ success: true, skipped: "duplicate" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 1. Push notification — respects per-category prefs
    try {
      const { data: pushRes, error: pushErr } = await sb.functions.invoke(
        "send-push-notification",
        {
          body: {
            user_ids: [user_id],
            title,
            body,
            url: "/merchant",
            category: "merchant_ops",
            data: {
              type: "merchant_approval",
              status,
              merchant_id: merchant_id ?? null,
              business_name: biz,
              cta_label: ctaLabel,
              cta_url: "/merchant",
            },
          },
        },
      );
      results.push = pushErr ? { error: pushErr.message } : pushRes;
    } catch (e) {
      results.push = { error: e instanceof Error ? e.message : "push failed" };
    }

    // 2. In-app notification (in case the trigger insert was skipped)
    try {
      await sb.from("notifications").insert({
        user_id,
        title,
        body,
        category: "merchant_ops",
        metadata: {
          type: "merchant_approval",
          status,
          merchant_id: merchant_id ?? null,
          reason: reason ?? null,
        },
      });
      results.inapp = { ok: true };
    } catch (e) {
      results.inapp = { error: e instanceof Error ? e.message : "inapp failed" };
    }

    // 3. Email via Resend (matches existing notify-api-access-decision pattern)
    const { data: profile } = await sb
      .from("profiles")
      .select("email, name, phone")
      .eq("user_id", user_id)
      .maybeSingle();

    if (profile?.email) {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        try {
          const accent = isApproved ? "#16a34a" : "#dc2626";
          const accentSoft = isApproved ? "#ecfdf5" : "#fef2f2";
          const accentBorder = isApproved ? "#a7f3d0" : "#fecaca";
          const safeBiz = String(biz).replace(/</g, "&lt;");
          const safeName = String(profile.name || "Merchant").replace(/</g, "&lt;");
          const safeReason = reason ? String(reason).replace(/</g, "&lt;") : "";
          const heading = isApproved
            ? `✅ ${safeBiz} is approved`
            : `❌ ${safeBiz} needs changes`;
          const intro = isApproved
            ? `Great news, ${safeName} — <strong>${safeBiz}</strong> has been approved on EasyPay Shop and is ready to go live.`
            : `Hi ${safeName}, your application for <strong>${safeBiz}</strong> needs a few changes before we can approve it.`;
          const stepsBlock = isApproved
            ? `<div style="background:${accentSoft};border:1px solid ${accentBorder};border-radius:10px;padding:14px 16px;margin:18px 0;">
                 <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${accent};letter-spacing:.3px;text-transform:uppercase;">Next steps</p>
                 <ol style="margin:0;padding-left:20px;font-size:14px;color:#334155;line-height:1.6;">
                   <li>Add your bank account so we can settle payouts</li>
                   <li>List your first products in the Merchant dashboard</li>
                   <li>Enable order notifications to never miss a sale</li>
                 </ol>
               </div>`
            : `<div style="background:${accentSoft};border:1px solid ${accentBorder};border-radius:10px;padding:14px 16px;margin:18px 0;">
                 <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${accent};letter-spacing:.3px;text-transform:uppercase;">What to do next</p>
                 <ol style="margin:0;padding-left:20px;font-size:14px;color:#334155;line-height:1.6;">
                   <li>Open the Merchant dashboard</li>
                   <li>Review the reviewer's note${safeReason ? "" : " on your application"}</li>
                   <li>Update your details and resubmit for review</li>
                 </ol>
               </div>`;
          const ctaBlock = `
            <div style="text-align:center;margin:28px 0 8px;">
              <a href="${ctaUrl}" style="background:${accent};color:#ffffff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">${ctaLabel} →</a>
              <p style="margin:10px 0 0;color:#64748b;font-size:12px;">${nextStep}</p>
            </div>`;
          const html = `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px 24px;background:#ffffff;">
              <h2 style="color:${accent};margin:0 0 16px;font-size:20px;">${heading}</h2>
              <p style="font-size:14px;color:#334155;line-height:1.55;margin:0 0 12px;">${intro}</p>
              ${!isApproved && safeReason ? `<p style="background:${accentSoft};border:1px solid ${accentBorder};padding:10px 12px;border-radius:8px;color:#991b1b;font-size:13px;margin:12px 0;"><strong>Reviewer's note:</strong> ${safeReason}</p>` : ""}
              ${stepsBlock}
              ${ctaBlock}
              <hr style="border:none;border-top:1px solid #eee;margin:28px 0 16px;">
              <p style="color:#94a3b8;font-size:12px;margin:0;">EasyPay — Secure Digital Wallet · This is an automated message about <strong>${safeBiz}</strong>.</p>
            </div>`;
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
                ? `🎉 ${biz} is approved on EasyPay — start selling`
                : `Action needed: ${biz} vendor application`,
              html,
            }),
          });
          const data = await emailRes.json();
          results.email = emailRes.ok ? { success: true, id: data?.id } : { error: data };
        } catch (e) {
          results.email = { error: e instanceof Error ? e.message : "email failed" };
        }
      } else {
        results.email = { skipped: "RESEND_API_KEY not configured" };
      }
    } else {
      results.email = { skipped: "no email on profile" };
    }

    // 4. SMS fallback via Twilio — only when both push & email did NOT succeed.
    const pushOk =
      results.push &&
      !results.push.error &&
      !results.push.skipped &&
      (results.push.success === true ||
        (typeof results.push.sent === "number" && results.push.sent > 0));
    const emailOk =
      results.email && results.email.success === true && !results.email.error;

    if (!pushOk && !emailOk) {
      const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
      const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
      const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER");
      const rawPhone = profile?.phone?.toString().trim();

      if (!rawPhone) {
        results.sms = { skipped: "no phone on profile" };
      } else if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
        results.sms = { skipped: "twilio not configured" };
      } else {
        // Format BD phone (mirrors notify-recipient pattern)
        let phone = rawPhone;
        if (phone.startsWith("01")) phone = "+88" + phone;
        else if (!phone.startsWith("+")) phone = "+" + phone;

        const shortBiz = biz.length > 30 ? biz.slice(0, 27) + "..." : biz;
        const smsBody = isApproved
          ? `EasyPay: ${shortBiz} is approved! Open your Merchant dashboard to add bank details & list products. ${ctaUrl}`
          : `EasyPay: Action needed for ${shortBiz}.${reason?.trim() ? ` Reason: ${reason.trim().slice(0, 80)}.` : ""} Review & resubmit: ${ctaUrl}`;

        try {
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
            },
          );
          const smsData = await smsRes.json();
          results.sms = smsRes.ok
            ? { success: true, sid: smsData?.sid, fallback: true, reason: { pushOk, emailOk } }
            : { error: smsData, fallback: true };
        } catch (e) {
          results.sms = {
            error: e instanceof Error ? e.message : "sms failed",
            fallback: true,
          };
        }
      }
    } else {
      results.sms = { skipped: "primary channels delivered", pushOk, emailOk };
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-merchant-approval error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

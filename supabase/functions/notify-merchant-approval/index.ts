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
    const title = isApproved
      ? "You're approved 🎉 — start selling"
      : "Vendor application needs changes";
    const body = isApproved
      ? "Your vendor account is live. Set your bank details and add products to go live on EasyPay Shop."
      : (reason?.trim()
          ? `Reason: ${reason.trim()}`
          : "Please review the feedback in your Merchant dashboard and resubmit.");

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
      .select("email, name")
      .eq("user_id", user_id)
      .maybeSingle();

    if (profile?.email) {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        try {
          const accent = isApproved ? "#16a34a" : "#dc2626";
          const biz = business_name || "your business";
          const cta = isApproved
            ? `<p style="margin:24px 0;"><a href="https://pay-palooza-go.lovable.app/merchant" style="background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Open Merchant Dashboard</a></p>`
            : `<p style="margin:24px 0;"><a href="https://pay-palooza-go.lovable.app/merchant" style="background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Review & Resubmit</a></p>`;
          const html = `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#ffffff;">
              <h2 style="color:${accent};margin:0 0 12px;">${isApproved ? "✅ Vendor Application Approved" : "❌ Vendor Application Needs Changes"}</h2>
              <p style="font-size:14px;color:#0f172a;">Dear ${profile.name || "Merchant"},</p>
              <p style="font-size:14px;color:#334155;line-height:1.55;">
                ${isApproved
                  ? `Great news — <strong>${biz}</strong> has been approved on EasyPay Shop. ${body}`
                  : `Your application for <strong>${biz}</strong> needs a few changes before we can approve it.`}
              </p>
              ${!isApproved && reason ? `<p style="background:#fef2f2;border:1px solid #fecaca;padding:10px 12px;border-radius:8px;color:#991b1b;font-size:13px;"><strong>Reviewer's note:</strong> ${reason}</p>` : ""}
              ${isApproved ? `<ul style="font-size:14px;color:#334155;line-height:1.6;padding-left:18px;"><li>Add your bank account for payouts</li><li>Enable order notifications</li><li>List your first products</li></ul>` : ""}
              ${cta}
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
              <p style="color:#999;font-size:12px;">EasyPay — Secure Digital Wallet</p>
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
                ? "Your EasyPay vendor application is approved"
                : "Action needed on your EasyPay vendor application",
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

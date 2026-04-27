// Sends push notification + email when a merchant API access request status
// changes from pending to approved/rejected. Triggered by a Postgres trigger
// (pg_net) on merchant_api_access_requests.
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
    const { user_id, status, reviewer_note } = await req.json();
    if (!user_id || !["approved", "rejected"].includes(status)) {
      return new Response(JSON.stringify({ error: "user_id and valid status required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isApproved = status === "approved";
    const title = isApproved ? "API access approved 🎉" : "API access request denied";
    const body = isApproved
      ? "You can now generate API keys and configure webhooks from your Merchant Dashboard."
      : (reviewer_note?.trim()
          ? `Reason: ${reviewer_note.trim()}`
          : "Your request was denied. You can submit a new request or contact support.");

    const results: Record<string, any> = {};

    // 1. Push notification — respects per-category prefs in send-push-notification
    try {
      const { data: pushRes, error: pushErr } = await sb.functions.invoke(
        "send-push-notification",
        {
          body: {
            user_ids: [user_id],
            title,
            body,
            url: "/merchant",
            category: "merchant_api",
          },
        },
      );
      results.push = pushErr ? { error: pushErr.message } : pushRes;
    } catch (e) {
      results.push = { error: e instanceof Error ? e.message : "push failed" };
    }

    // 2. Email via Resend (matches the project's existing pattern in kyc-notify)
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
          const cta = isApproved
            ? `<p style="margin:24px 0;"><a href="https://pay-palooza-go.lovable.app/merchant" style="background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Open Merchant Dashboard</a></p>`
            : "";
          const html = `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#ffffff;">
              <h2 style="color:${accent};margin:0 0 12px;">${isApproved ? "✅ API Access Approved" : "❌ API Access Denied"}</h2>
              <p style="font-size:14px;color:#0f172a;">Dear ${profile.name || "Merchant"},</p>
              <p style="font-size:14px;color:#334155;line-height:1.55;">${body}</p>
              ${!isApproved && reviewer_note ? `<p style="background:#fef2f2;border:1px solid #fecaca;padding:10px 12px;border-radius:8px;color:#991b1b;font-size:13px;"><strong>Admin's note:</strong> ${reviewer_note}</p>` : ""}
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
              subject: isApproved ? "Your EasyPay API access is approved" : "Update on your EasyPay API access request",
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
    console.error("notify-api-access-decision error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

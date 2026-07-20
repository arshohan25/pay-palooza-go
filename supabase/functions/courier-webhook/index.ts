// Public courier webhook endpoint.
// Couriers POST scan events; we verify a shared secret, insert into
// courier_tracking_events (which auto-syncs the order via trigger), then
// notify the buyer via SMS + email with the latest status and ETA.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-courier-provider",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STATUS_LABELS: Record<string, string> = {
  booked: "Booked",
  picked_up: "Picked up",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  failed: "Delivery failed",
  returned: "Returned",
};

const STATUS_EMOJI: Record<string, string> = {
  booked: "📦", picked_up: "🚚", in_transit: "🚛",
  out_for_delivery: "🛵", delivered: "🎉", failed: "❌", returned: "↩️",
};

// Normalize incoming statuses from various couriers to our canonical set.
function normalizeStatus(raw: string): string {
  const s = (raw || "").toLowerCase().trim();
  if (["delivered", "success", "completed"].includes(s)) return "delivered";
  if (["out_for_delivery", "out-for-delivery", "ofd", "on_the_way"].includes(s)) return "out_for_delivery";
  if (["in_transit", "transit", "shipped", "in-transit"].includes(s)) return "in_transit";
  if (["picked_up", "pickup", "picked"].includes(s)) return "picked_up";
  if (["booked", "created", "placed"].includes(s)) return "booked";
  if (["failed", "cancelled", "canceled", "rejected"].includes(s)) return "failed";
  if (["returned", "return"].includes(s)) return "returned";
  return s || "in_transit";
}

function fmtEta(eta: string | null): string {
  if (!eta) return "";
  try {
    return new Date(eta).toLocaleString("en-BD", { dateStyle: "medium", timeStyle: "short" });
  } catch { return ""; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const secret = Deno.env.get("COURIER_WEBHOOK_SECRET") ?? "";
  const provided = req.headers.get("x-webhook-secret") ?? "";
  if (!secret || provided !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const provider =
      body.provider || body.courier || req.headers.get("x-courier-provider") || "Unknown";
    const tracking_number = body.tracking_number || body.trackingNumber || body.consignment_id || body.awb;
    const order_num = body.order_num || body.merchant_order_id;
    const rawStatus = body.status || body.event || body.state;

    if (!rawStatus || (!tracking_number && !order_num)) {
      return new Response(
        JSON.stringify({ error: "status and tracking_number (or order_num) required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Locate the order
    let orderQ = admin.from("orders").select("id, order_num, user_id, shipping_phone, shipping_name, courier_provider").limit(1);
    if (tracking_number) orderQ = orderQ.eq("tracking_number", tracking_number);
    else orderQ = orderQ.eq("order_num", order_num);
    const { data: orderRow, error: orderErr } = await orderQ.maybeSingle();

    if (orderErr || !orderRow) {
      return new Response(
        JSON.stringify({ error: "Order not found for tracking", tracking_number, order_num }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const status = normalizeStatus(rawStatus);
    const status_label = body.status_label || STATUS_LABELS[status] || rawStatus;
    const location = body.location || body.hub || body.city || null;
    const note = body.note || body.message || body.description || null;
    const eta = body.eta || body.estimated_delivery || body.expected_delivery || null;
    const scanned_at = body.scanned_at || body.timestamp || body.event_time || new Date().toISOString();

    // Insert the tracking event (order sync trigger fires automatically)
    const { error: insErr } = await admin.from("courier_tracking_events").insert({
      order_id: orderRow.id,
      courier_provider: provider,
      tracking_number: tracking_number ?? null,
      status,
      status_label,
      location,
      note,
      eta,
      scanned_at,
      raw: body,
    });
    if (insErr) {
      return new Response(JSON.stringify({ error: "Insert failed", details: insErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up buyer contact
    const { data: profile } = await admin
      .from("profiles")
      .select("phone, name, email")
      .eq("user_id", orderRow.user_id)
      .maybeSingle();

    const buyerPhone = profile?.phone || orderRow.shipping_phone || null;
    const buyerEmail = profile?.email || null;

    const emoji = STATUS_EMOJI[status] ?? "📦";
    const etaStr = fmtEta(eta);
    const orderNum = orderRow.order_num;
    const locStr = location ? ` at ${location}` : "";
    const etaLine = etaStr ? ` ETA ${etaStr}.` : "";
    const smsBody =
      `EasyPay: ${emoji} Order ${orderNum} — ${status_label}${locStr} via ${provider}.${etaLine}`;

    // Send SMS via Twilio (best-effort)
    let smsOutcome: "sent" | "failed" | "skipped" = "skipped";
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM && buyerPhone) {
      let phone = buyerPhone;
      if (phone.startsWith("01")) phone = "+88" + phone;
      else if (!phone.startsWith("+")) phone = "+" + phone;
      const form = new URLSearchParams();
      form.append("To", phone); form.append("From", TWILIO_FROM); form.append("Body", smsBody);
      try {
        const r = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form.toString(),
          },
        );
        smsOutcome = r.ok ? "sent" : "failed";
      } catch { smsOutcome = "failed"; }
    }

    // Send email via Resend (best-effort)
    let emailOutcome: "sent" | "failed" | "skipped" = "skipped";
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_KEY && buyerEmail) {
      const html = `
        <div style="font-family:system-ui,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;background:#0f172a;color:#fff;border-radius:16px">
          <div style="font-size:14px;opacity:.7">EasyPay Delivery Update</div>
          <h2 style="margin:8px 0 16px;font-size:22px">${emoji} ${status_label}</h2>
          <div style="background:rgba(255,255,255,.06);padding:16px;border-radius:12px;line-height:1.6">
            <div><strong>Order:</strong> ${orderNum}</div>
            <div><strong>Courier:</strong> ${provider}</div>
            ${tracking_number ? `<div><strong>Tracking:</strong> ${tracking_number}</div>` : ""}
            ${location ? `<div><strong>Location:</strong> ${location}</div>` : ""}
            ${etaStr ? `<div><strong>ETA:</strong> ${etaStr}</div>` : ""}
            ${note ? `<div style="margin-top:8px;opacity:.85">${note}</div>` : ""}
          </div>
          <p style="font-size:12px;opacity:.6;margin-top:20px">You're receiving this because you have an active order on EasyPay.</p>
        </div>`;
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "EasyPay <notifications@easypay.app>",
            to: [buyerEmail],
            subject: `${emoji} Order ${orderNum} — ${status_label}`,
            html,
          }),
        });
        emailOutcome = r.ok ? "sent" : "failed";
      } catch { emailOutcome = "failed"; }
    }

    // Best-effort in-app notification row
    try {
      await admin.from("notifications").insert({
        user_id: orderRow.user_id,
        title: `Order ${orderNum} — ${status_label}`,
        body: `${provider}${locStr}.${etaLine}`,
        category: "orders",
        meta: { order_id: orderRow.id, status, courier_provider: provider, tracking_number, eta },
      });
    } catch { /* ignore optional notif failure */ }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: orderRow.id,
        status,
        sms: smsOutcome,
        email: emailOutcome,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("courier-webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String((err as Error)?.message ?? err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

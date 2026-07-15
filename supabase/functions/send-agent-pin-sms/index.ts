// Sends a 4-digit temp PIN to a new agent via a BD SMS gateway.
// Configurable via secrets:
//   SMS_API_URL     - full endpoint URL (e.g. https://bulksmsbd.net/api/smsapi)
//   SMS_API_KEY     - provider API key / token
//   SMS_SENDER_ID   - approved sender ID / mask
//
// Default payload shape follows the common BulkSMSBD-style JSON contract:
//   { api_key, senderid, number, message, type: "text" }
// If your provider expects a different shape, adjust the `body` below.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Payload {
  phone: string;      // 11-digit BD number (01XXXXXXXXX)
  pin: string;        // 4-digit PIN
  name?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { phone, pin, name } = (await req.json()) as Payload;

    if (!/^01[3-9]\d{8}$/.test(phone)) {
      return json({ error: "Invalid BD phone" }, 400);
    }
    if (!/^\d{4}$/.test(pin)) {
      return json({ error: "Invalid PIN" }, 400);
    }

    const apiUrl = Deno.env.get("SMS_API_URL");
    const apiKey = Deno.env.get("SMS_API_KEY");
    const senderId = Deno.env.get("SMS_SENDER_ID");

    if (!apiUrl || !apiKey || !senderId) {
      console.error("SMS gateway not configured", {
        hasUrl: !!apiUrl, hasKey: !!apiKey, hasSender: !!senderId,
      });
      return json({ error: "SMS gateway not configured" }, 500);
    }

    const to = `88${phone}`; // E.164-lite for BD
    const message =
      `Welcome${name ? " " + name : ""}! Your EasyPay agent account is ready. ` +
      `Temporary PIN: ${pin}. Please change it after your first sign-in.`;

    const body = {
      api_key: apiKey,
      senderid: senderId,
      number: to,
      message,
      type: "text",
    };

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`SMS provider failed [${res.status}]: ${text}`);
      return json({ error: "SMS provider failed", status: res.status, details: text }, res.status);
    }

    console.log("SMS sent", { to, status: res.status });
    return json({ ok: true, provider_response: text });
  } catch (err) {
    console.error("send-agent-pin-sms error", err);
    return json({ error: (err as Error).message ?? "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hmacSign(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), { status: 400, headers: corsHeaders });
    }

    // Get session + API key info
    const { data: session } = await supabase
      .from("merchant_payment_sessions")
      .select("*, merchant_api_keys!api_key_id(secret_key, webhook_url)")
      .eq("id", session_id)
      .single();

    if (!session) {
      return new Response(JSON.stringify({ error: "Session not found" }), { status: 404, headers: corsHeaders });
    }

    const callbackUrl = session.callback_url || (session.merchant_api_keys as any)?.webhook_url;
    if (!callbackUrl) {
      // No webhook configured, just mark as delivered
      await supabase
        .from("merchant_payment_sessions")
        .update({ webhook_delivered: true, updated_at: new Date().toISOString() })
        .eq("id", session_id);
      return new Response(JSON.stringify({ success: true, message: "No webhook URL configured" }), { headers: corsHeaders });
    }

    const secretKey = (session.merchant_api_keys as any)?.secret_key || "";

    const payload = JSON.stringify({
      event: session.status === "completed" ? "payment.completed" : "payment.failed",
      session_id: session.id,
      amount: session.amount,
      currency: session.currency,
      reference: session.reference,
      status: session.status,
      customer_phone: session.customer_phone,
      completed_at: session.completed_at,
      timestamp: new Date().toISOString(),
    });

    const signature = await hmacSign(secretKey, payload);

    // POST to merchant webhook
    try {
      const webhookRes = await fetch(callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-EasyPay-Signature": signature,
          "X-EasyPay-Timestamp": new Date().toISOString(),
        },
        body: payload,
      });

      await supabase
        .from("merchant_payment_sessions")
        .update({
          webhook_delivered: webhookRes.ok,
          updated_at: new Date().toISOString(),
          metadata: {
            ...(session.metadata || {}),
            webhook_status: webhookRes.status,
            webhook_delivered_at: new Date().toISOString(),
          },
        })
        .eq("id", session_id);

      return new Response(JSON.stringify({
        success: true,
        webhook_status: webhookRes.status,
        delivered: webhookRes.ok,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (fetchErr) {
      await supabase
        .from("merchant_payment_sessions")
        .update({
          webhook_delivered: false,
          updated_at: new Date().toISOString(),
          metadata: {
            ...(session.metadata || {}),
            webhook_error: String(fetchErr),
            webhook_attempted_at: new Date().toISOString(),
          },
        })
        .eq("id", session_id);

      return new Response(JSON.stringify({ success: false, error: "Webhook delivery failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

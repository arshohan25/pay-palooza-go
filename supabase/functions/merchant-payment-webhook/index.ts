import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BACKOFF_SCHEDULE = [60, 300, 1800, 7200, 86400]; // 1m, 5m, 30m, 2h, 24h in seconds
const MAX_ATTEMPTS = 5;
const INLINE_RETRIES = 3;
const INLINE_DELAYS = [1000, 3000, 9000]; // 1s, 3s, 9s

async function hmacSign(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function deliverWebhook(callbackUrl: string, payload: string, signature: string): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-EasyPay-Signature": signature,
      "X-EasyPay-Timestamp": new Date().toISOString(),
    },
    body: payload,
  });
  return { ok: res.ok, status: res.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Internal-only: require shared service-role secret. Prevents anonymous
  // callers from triggering webhook delivery or enumerating session_ids.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-internal-secret") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  if (bearer !== serviceKey && headerSecret !== serviceKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
  );


  try {
    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), { status: 400, headers: corsHeaders });
    }

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
      await supabase
        .from("merchant_payment_sessions")
        .update({ webhook_delivered: true, updated_at: new Date().toISOString() })
        .eq("id", session_id);
      return new Response(JSON.stringify({ success: true, message: "No webhook URL configured" }), { headers: corsHeaders });
    }

    const secretKey = (session.merchant_api_keys as any)?.secret_key || "";
    const currentAttempts = session.webhook_attempts || 0;

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

    // Try inline delivery with retries
    let delivered = false;
    let lastStatus = 0;
    let lastError = "";

    for (let i = 0; i < INLINE_RETRIES; i++) {
      try {
        const result = await deliverWebhook(callbackUrl, payload, signature);
        lastStatus = result.status;
        if (result.ok) {
          delivered = true;
          break;
        }
      } catch (err) {
        lastError = String(err);
      }
      if (i < INLINE_RETRIES - 1) {
        await sleep(INLINE_DELAYS[i]);
      }
    }

    const newAttempts = currentAttempts + 1;

    if (delivered) {
      await supabase
        .from("merchant_payment_sessions")
        .update({
          webhook_delivered: true,
          webhook_attempts: newAttempts,
          webhook_next_retry_at: null,
          updated_at: new Date().toISOString(),
          metadata: {
            ...(session.metadata || {}),
            webhook_status: lastStatus,
            webhook_delivered_at: new Date().toISOString(),
          },
        })
        .eq("id", session_id);

      return new Response(JSON.stringify({ success: true, delivered: true, attempts: newAttempts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Failed — schedule async retry if under max attempts
    const nextRetryAt = newAttempts < MAX_ATTEMPTS
      ? new Date(Date.now() + BACKOFF_SCHEDULE[Math.min(newAttempts - 1, BACKOFF_SCHEDULE.length - 1)] * 1000).toISOString()
      : null;

    await supabase
      .from("merchant_payment_sessions")
      .update({
        webhook_delivered: false,
        webhook_attempts: newAttempts,
        webhook_next_retry_at: nextRetryAt,
        updated_at: new Date().toISOString(),
        metadata: {
          ...(session.metadata || {}),
          webhook_error: lastError || `HTTP ${lastStatus}`,
          webhook_attempted_at: new Date().toISOString(),
          ...(newAttempts >= MAX_ATTEMPTS ? { webhook_permanently_failed: true } : {}),
        },
      })
      .eq("id", session_id);

    return new Response(JSON.stringify({
      success: false,
      delivered: false,
      attempts: newAttempts,
      next_retry_at: nextRetryAt,
      permanently_failed: newAttempts >= MAX_ATTEMPTS,
    }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

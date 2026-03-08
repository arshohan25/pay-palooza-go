import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BACKOFF_SCHEDULE = [60, 300, 1800, 7200, 86400]; // seconds
const MAX_ATTEMPTS = 5;

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
    // Find sessions that need webhook retry
    const { data: sessions, error } = await supabase
      .from("merchant_payment_sessions")
      .select("*, merchant_api_keys!api_key_id(secret_key, webhook_url)")
      .eq("webhook_delivered", false)
      .lt("webhook_attempts", MAX_ATTEMPTS)
      .lte("webhook_next_retry_at", new Date().toISOString())
      .in("status", ["completed", "failed"])
      .not("webhook_next_retry_at", "is", null)
      .limit(20);

    if (error) throw error;
    if (!sessions || sessions.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let successCount = 0;
    let failCount = 0;

    for (const session of sessions) {
      const callbackUrl = session.callback_url || (session.merchant_api_keys as any)?.webhook_url;
      if (!callbackUrl) continue;

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
      const newAttempts = (session.webhook_attempts || 0) + 1;

      try {
        const res = await fetch(callbackUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-EasyPay-Signature": signature,
            "X-EasyPay-Timestamp": new Date().toISOString(),
          },
          body: payload,
        });

        if (res.ok) {
          await supabase
            .from("merchant_payment_sessions")
            .update({
              webhook_delivered: true,
              webhook_attempts: newAttempts,
              webhook_next_retry_at: null,
              updated_at: new Date().toISOString(),
              metadata: {
                ...(session.metadata || {}),
                webhook_status: res.status,
                webhook_delivered_at: new Date().toISOString(),
                webhook_retry_succeeded_at_attempt: newAttempts,
              },
            })
            .eq("id", session.id);
          successCount++;
        } else {
          const nextRetryAt = newAttempts < MAX_ATTEMPTS
            ? new Date(Date.now() + BACKOFF_SCHEDULE[Math.min(newAttempts - 1, BACKOFF_SCHEDULE.length - 1)] * 1000).toISOString()
            : null;

          await supabase
            .from("merchant_payment_sessions")
            .update({
              webhook_attempts: newAttempts,
              webhook_next_retry_at: nextRetryAt,
              updated_at: new Date().toISOString(),
              metadata: {
                ...(session.metadata || {}),
                webhook_error: `HTTP ${res.status}`,
                webhook_attempted_at: new Date().toISOString(),
                ...(newAttempts >= MAX_ATTEMPTS ? { webhook_permanently_failed: true } : {}),
              },
            })
            .eq("id", session.id);
          failCount++;
        }
      } catch (fetchErr) {
        const nextRetryAt = newAttempts < MAX_ATTEMPTS
          ? new Date(Date.now() + BACKOFF_SCHEDULE[Math.min(newAttempts - 1, BACKOFF_SCHEDULE.length - 1)] * 1000).toISOString()
          : null;

        await supabase
          .from("merchant_payment_sessions")
          .update({
            webhook_attempts: newAttempts,
            webhook_next_retry_at: nextRetryAt,
            updated_at: new Date().toISOString(),
            metadata: {
              ...(session.metadata || {}),
              webhook_error: String(fetchErr),
              webhook_attempted_at: new Date().toISOString(),
              ...(newAttempts >= MAX_ATTEMPTS ? { webhook_permanently_failed: true } : {}),
            },
          })
          .eq("id", session.id);
        failCount++;
      }
    }

    return new Response(JSON.stringify({ processed: sessions.length, success: successCount, failed: failCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Biller provider webhook: HMAC-signature verified + event-id deduplicated.
// POST with headers:
//   X-Biller-Provider: <biller_code>
//   X-Biller-Signature: <hex hmac-sha256 of raw body using per-biller secret>
//   X-Biller-Event-Id: <unique event id from provider>
// Body: { event: "paid"|"failed"|"reversed"|"disputed"|..., reference, provider_ref?, amount?, message? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-biller-provider, x-biller-signature, x-biller-event-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const provider = req.headers.get("x-biller-provider")?.toLowerCase().trim();
  const signature = req.headers.get("x-biller-signature")?.toLowerCase().trim();
  const eventId = req.headers.get("x-biller-event-id")?.trim();

  if (!provider || !signature || !eventId) {
    return json(400, { error: "Missing provider, signature, or event id headers" });
  }

  const raw = await req.text();
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return json(400, { error: "Invalid JSON" }); }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, svcKey);

  // Resolve per-biller secret from biller_api_configs.config.webhook_secret,
  // fall back to env var BILLER_WEBHOOK_SECRET_<CODE>.
  const { data: biller } = await admin
    .from("biller_api_configs")
    .select("biller_code, config, is_enabled")
    .eq("biller_code", provider)
    .maybeSingle();

  const cfgSecret = (biller?.config as any)?.webhook_secret as string | undefined;
  const envSecret = Deno.env.get(`BILLER_WEBHOOK_SECRET_${provider.toUpperCase()}`);
  const secret = cfgSecret || envSecret;
  if (!secret) return json(503, { error: "Webhook signing not configured for provider" });

  const expected = await hmacHex(secret, raw);
  if (!timingSafeEqual(expected, signature)) return json(401, { error: "Invalid signature" });

  // Event dedup — unique(provider, event_id)
  const { error: dupErr } = await admin.from("webhook_events").insert({
    provider,
    event_id: eventId,
    event_type: payload.event ?? null,
    reference: payload.reference ?? null,
    signature,
    payload,
  });
  if (dupErr) {
    // 23505 = unique_violation → already processed, ack idempotently
    if ((dupErr as any).code === "23505") {
      return json(200, { success: true, deduped: true });
    }
    console.error("webhook_events insert failed", dupErr);
    return json(500, { error: "Ledger write failed" });
  }

  // Apply to settlement (only if we have a reference to key off)
  const reference = payload.reference as string | undefined;
  const event = String(payload.event ?? "").toLowerCase();
  let result = "no_reference";

  if (reference) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (payload.provider_ref) patch.provider_ref = payload.provider_ref;
    if (payload.message) patch.admin_note = payload.message;

    if (event === "paid" || event === "success") {
      patch.status = "paid";
      patch.paid_at = new Date().toISOString();
      result = "marked_paid";
    } else if (event === "failed" || event === "rejected") {
      patch.status = "failed";
      result = "marked_failed";
    } else if (event === "reversed" || event === "refunded") {
      patch.status = "refunded";
      result = "marked_refunded";
    } else if (event === "disputed") {
      patch.dispute_status = "evidence_pending";
      patch.dispute_reason = payload.message ?? "Provider raised dispute";
      patch.dispute_opened_at = new Date().toISOString();
      result = "dispute_opened";
    } else {
      result = "ignored_event";
    }

    if (result !== "ignored_event" && result !== "no_reference") {
      const { data: updated } = await admin
        .from("biller_settlements")
        .update(patch)
        .eq("reference", reference)
        .select("id, transaction_id")
        .maybeSingle();

      if (updated?.transaction_id) {
        await admin.from("transaction_events").insert({
          transaction_id: updated.transaction_id,
          event_type: `webhook_${event}`,
          status: patch.status ?? null,
          note: payload.message ?? null,
          meta: { provider, event_id: eventId, provider_ref: payload.provider_ref ?? null },
        });
      }
    }
  }

  await admin.from("webhook_events").update({ result }).eq("provider", provider).eq("event_id", eventId);
  return json(200, { success: true, result });
});

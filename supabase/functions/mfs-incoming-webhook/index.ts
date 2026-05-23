import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Provider-specific HMAC secret env var names
const PROVIDER_SECRET_MAP: Record<string, string> = {
  bkash: "BKASH_WEBHOOK_SECRET",
  nagad: "NAGAD_WEBHOOK_SECRET",
  rocket: "ROCKET_WEBHOOK_SECRET",
};

async function verifyHmac(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computed === signature.toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.text();
    const payload = JSON.parse(body);
    const { provider, txn_id, sender_number, amount, timestamp, signature } =
      payload;

    // Validate required fields
    if (!provider || !txn_id || !amount) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: provider, txn_id, amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedProvider = provider.toLowerCase();
    if (!["bkash", "nagad", "rocket"].includes(normalizedProvider)) {
      return new Response(
        JSON.stringify({ error: "Unsupported provider" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify HMAC signature — REQUIRED. If secret missing or signature absent/invalid, reject.
    const secretEnvName = PROVIDER_SECRET_MAP[normalizedProvider];
    const webhookSecret = Deno.env.get(secretEnvName);
    if (!webhookSecret) {
      console.error(`Webhook secret ${secretEnvName} not configured for ${normalizedProvider}`);
      return new Response(
        JSON.stringify({ error: "Webhook signing not configured for provider" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const valid = await verifyHmac(body, signature, webhookSecret);
    if (!valid) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create service-role client for DB operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check for duplicate incoming payment
    const { data: existing } = await supabase
      .from("mfs_incoming_payments")
      .select("id")
      .eq("provider", normalizedProvider)
      .eq("txn_id", txn_id)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ status: "duplicate", message: "Payment already processed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to match a pending fund_request
    const numericAmount = parseFloat(amount);
    const { data: matchingRequest } = await supabase
      .from("fund_requests")
      .select("id, user_id")
      .eq("status", "pending")
      .eq("type", "add_money")
      .eq("source_method", normalizedProvider)
      .eq("amount", numericAmount)
      .ilike("transaction_id_proof", txn_id)
      .limit(1)
      .maybeSingle();

    let matchStatus = "unmatched";
    let matchedRequestId: string | null = null;

    if (matchingRequest) {
      // Auto-approve via RPC using service role
      // We need to call the function as if an admin is doing it
      // Since service role bypasses RLS, we call the SQL directly
      const { error: approveError } = await supabase.rpc(
        "admin_approve_fund_request",
        {
          p_request_id: matchingRequest.id,
          p_admin_note: `Auto-approved via ${normalizedProvider} webhook. TxnID: ${txn_id}`,
        }
      );

      if (!approveError) {
        matchStatus = "matched";
        matchedRequestId = matchingRequest.id;
      } else {
        // If auto-approve fails (e.g. no admin context), log as unmatched
        console.error("Auto-approve failed:", approveError.message);
        matchStatus = "unmatched";
      }
    }

    // Log incoming payment
    const { error: insertError } = await supabase
      .from("mfs_incoming_payments")
      .insert({
        provider: normalizedProvider,
        txn_id,
        sender_number: sender_number || null,
        amount: numericAmount,
        status: matchStatus,
        matched_request_id: matchedRequestId,
        raw_payload: payload,
      });

    if (insertError) {
      console.error("Failed to log incoming payment:", insertError.message);
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        matched: matchStatus === "matched",
        message:
          matchStatus === "matched"
            ? "Payment matched and auto-approved"
            : "Payment logged for manual review",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

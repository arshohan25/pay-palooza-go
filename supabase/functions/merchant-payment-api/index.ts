import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const apiKey = req.headers.get("x-api-key") || req.headers.get("X-API-Key");
    if (!apiKey) return json({ error: "Missing X-API-Key header" }, 401);

    // Validate API key
    const { data: keyRow, error: keyErr } = await supabase
      .from("merchant_api_keys")
      .select("id, merchant_id, webhook_url, is_active, secret_key")
      .eq("api_key", apiKey)
      .single();

    if (keyErr || !keyRow) return json({ error: "Invalid API key" }, 401);
    if (!keyRow.is_active) return json({ error: "API key is deactivated" }, 403);

    // Get merchant info
    const { data: merchant } = await supabase
      .from("merchants")
      .select("id, business_name, status, user_id")
      .eq("id", keyRow.merchant_id)
      .single();

    if (!merchant || merchant.status !== "active") {
      return json({ error: "Merchant account is not active" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "create_session";

    // ═══════════════════════════════════════════
    // CREATE SESSION
    // ═══════════════════════════════════════════
    if (action === "create_session") {
      const { amount, reference, description, success_url, cancel_url, callback_url, customer_phone, metadata } = body;

      if (!amount || typeof amount !== "number" || amount < 1 || amount > 1000000) {
        return json({ error: "Amount must be between 1 and 1,000,000" }, 400);
      }

      // Rate limit: max 100 sessions per hour per merchant
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const { count } = await supabase
        .from("merchant_payment_sessions")
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", keyRow.merchant_id)
        .gte("created_at", oneHourAgo);

      if ((count ?? 0) >= 100) {
        return json({ error: "Rate limit exceeded. Max 100 sessions per hour." }, 429);
      }

      const { data: session, error: sessErr } = await supabase
        .from("merchant_payment_sessions")
        .insert({
          merchant_id: keyRow.merchant_id,
          api_key_id: keyRow.id,
          amount,
          reference: reference || null,
          description: description || null,
          success_url: success_url || null,
          cancel_url: cancel_url || null,
          callback_url: callback_url || keyRow.webhook_url || null,
          customer_phone: customer_phone || null,
          metadata: metadata || {},
        })
        .select("id, amount, currency, reference, status, expires_at, created_at")
        .single();

      if (sessErr) return json({ error: sessErr.message }, 500);

      const baseUrl = Deno.env.get("SITE_URL") || `https://${Deno.env.get("SUPABASE_URL")?.replace("https://", "").replace(".supabase.co", "")}-preview.lovable.app`;
      const checkoutUrl = `${baseUrl}/checkout/${session.id}`;

      return json({
        success: true,
        session_id: session.id,
        checkout_url: checkoutUrl,
        amount: session.amount,
        currency: session.currency,
        reference: session.reference,
        status: session.status,
        expires_at: session.expires_at,
      });
    }

    // ═══════════════════════════════════════════
    // CHECK STATUS
    // ═══════════════════════════════════════════
    if (action === "check_status") {
      const { session_id } = body;
      if (!session_id) return json({ error: "session_id required" }, 400);

      const { data: session, error } = await supabase
        .from("merchant_payment_sessions")
        .select("id, amount, currency, reference, status, customer_phone, payer_user_id, completed_at, expires_at, webhook_delivered, created_at")
        .eq("id", session_id)
        .eq("merchant_id", keyRow.merchant_id)
        .single();

      if (error || !session) return json({ error: "Session not found" }, 404);

      // Check expiry
      if (session.status === "pending" && new Date(session.expires_at) < new Date()) {
        await supabase
          .from("merchant_payment_sessions")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("id", session_id);
        session.status = "expired";
      }

      return json({ success: true, session });
    }

    // ═══════════════════════════════════════════
    // LIST SESSIONS
    // ═══════════════════════════════════════════
    if (action === "list_sessions") {
      const page = body.page || 1;
      const limit = Math.min(body.limit || 20, 100);
      const offset = (page - 1) * limit;

      const { data: sessions, count } = await supabase
        .from("merchant_payment_sessions")
        .select("id, amount, currency, reference, status, customer_phone, completed_at, expires_at, created_at", { count: "exact" })
        .eq("merchant_id", keyRow.merchant_id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      return json({
        success: true,
        sessions: sessions || [],
        total: count || 0,
        page,
        limit,
      });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return json({ error: "Internal server error" }, 500);
  }
});

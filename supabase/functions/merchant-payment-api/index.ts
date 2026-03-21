import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-app-password, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let keyRow: any = null;
  let action = "unknown";
  let statusCode = 200;
  let errorMessage: string | null = null;

  const logRequest = async () => {
    if (!keyRow) return;
    const elapsed = Date.now() - startTime;
    await supabase.from("merchant_api_logs").insert({
      merchant_id: keyRow.merchant_id,
      api_key_id: keyRow.id,
      action,
      status_code: statusCode,
      response_time_ms: elapsed,
      ip_address: getClientIp(req),
      user_agent: req.headers.get("user-agent")?.slice(0, 256) || null,
      error_message: errorMessage,
    }).then(() => {}, () => {});
  };

  try {
    const apiKey = req.headers.get("x-api-key") || req.headers.get("X-API-Key");
    if (!apiKey) return json({ error: "Missing X-API-Key header" }, 401);

    const appPassword = req.headers.get("x-app-password") || req.headers.get("X-App-Password");
    if (!appPassword) return json({ error: "Missing X-App-Password header" }, 401);

    // Validate API key + app password
    const { data: keyData, error: keyErr } = await supabase
      .from("merchant_api_keys")
      .select("id, merchant_id, webhook_url, is_active, secret_key, app_password, rate_limit_per_minute, ip_whitelist_enabled")
      .eq("api_key", apiKey)
      .single();

    if (keyErr || !keyData) return json({ error: "Invalid API key" }, 401);
    keyRow = keyData;

    if (!keyRow.is_active) { statusCode = 403; errorMessage = "API key deactivated"; await logRequest(); return json({ error: "API key is deactivated" }, 403); }
    if (keyRow.app_password && keyRow.app_password !== appPassword) { statusCode = 401; errorMessage = "Invalid app password"; await logRequest(); return json({ error: "Invalid App Password" }, 401); }

    // ═══ IP WHITELIST CHECK ═══
    if (keyRow.ip_whitelist_enabled) {
      const clientIp = getClientIp(req);
      const { data: allowedIps } = await supabase
        .from("merchant_ip_whitelist")
        .select("ip_address")
        .eq("merchant_id", keyRow.merchant_id);

      const whitelist = (allowedIps || []).map((r: any) => r.ip_address);
      if (whitelist.length > 0 && !whitelist.includes(clientIp)) {
        statusCode = 403;
        errorMessage = `IP ${clientIp} not whitelisted`;
        await logRequest();
        return json({ error: `IP address ${clientIp} is not whitelisted` }, 403);
      }
    }

    // ═══ PER-MINUTE RATE LIMIT ═══
    const rateLimit = keyRow.rate_limit_per_minute || 30;
    const oneMinAgo = new Date(Date.now() - 60000).toISOString();
    const { count: recentCount } = await supabase
      .from("merchant_api_logs")
      .select("id", { count: "exact", head: true })
      .eq("api_key_id", keyRow.id)
      .gte("created_at", oneMinAgo);

    if ((recentCount ?? 0) >= rateLimit) {
      statusCode = 429;
      errorMessage = `Rate limit ${rateLimit}/min exceeded`;
      await logRequest();
      return json({
        error: `Rate limit exceeded. Max ${rateLimit} requests per minute.`,
        retry_after_seconds: 60,
      }, 429);
    }

    // Get merchant info
    const { data: merchant } = await supabase
      .from("merchants")
      .select("id, business_name, status, user_id")
      .eq("id", keyRow.merchant_id)
      .single();

    if (!merchant || merchant.status !== "active") {
      statusCode = 403; errorMessage = "Merchant not active"; await logRequest();
      return json({ error: "Merchant account is not active" }, 403);
    }

    // Piggyback: expire stale sessions
    await supabase.rpc("expire_stale_payment_sessions").then(() => {}, () => {});

    const body = await req.json().catch(() => ({}));
    action = body.action || "create_session";

    // ═══════════════════════════════════════════
    // CREATE SESSION
    // ═══════════════════════════════════════════
    if (action === "create_session") {
      const { amount, reference, description, success_url, cancel_url, callback_url, customer_phone, metadata } = body;

      if (!amount || typeof amount !== "number" || amount < 1 || amount > 1000000) {
        statusCode = 400; errorMessage = "Invalid amount"; await logRequest();
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
        statusCode = 429; errorMessage = "100 sessions/hour exceeded"; await logRequest();
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

      if (sessErr) { statusCode = 500; errorMessage = sessErr.message; await logRequest(); return json({ error: sessErr.message }, 500); }

      // Derive app URL: avoid iframe/editor hosts that produce unusable public links
      const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/+$/, "") || "";
      const normalizedOrigin = origin.replace(/\/+$/, "");
      const isEditorHost = normalizedOrigin.includes("lovableproject.com");
      const baseUrl = (
        (!isEditorHost && normalizedOrigin) ||
        Deno.env.get("SITE_URL") ||
        "https://pay-palooza-go.lovable.app"
      );
      const checkoutUrl = `${baseUrl}/checkout/${session.id}`;
      const qrPageUrl = `${baseUrl}/pay/qr/${session.id}`;

      // Dynamic QR payload — scannable by EasyPay app
      const qrData = JSON.stringify({
        type: "easypay",
        sessionId: session.id,
        merchantId: keyRow.merchant_id,
        amount: session.amount,
        ref: session.reference || null,
      });

      await logRequest();
      return json({
        success: true,
        session_id: session.id,
        checkout_url: checkoutUrl,
        qr_page_url: qrPageUrl,
        qr_data: qrData,
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
      if (!session_id) { statusCode = 400; errorMessage = "Missing session_id"; await logRequest(); return json({ error: "session_id required" }, 400); }

      const { data: session, error } = await supabase
        .from("merchant_payment_sessions")
        .select("id, amount, currency, reference, status, customer_phone, payer_user_id, completed_at, expires_at, webhook_delivered, created_at")
        .eq("id", session_id)
        .eq("merchant_id", keyRow.merchant_id)
        .single();

      if (error || !session) { statusCode = 404; errorMessage = "Session not found"; await logRequest(); return json({ error: "Session not found" }, 404); }

      if (session.status === "pending" && new Date(session.expires_at) < new Date()) {
        await supabase
          .from("merchant_payment_sessions")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("id", session_id);
        session.status = "expired";
      }

      await logRequest();
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

      await logRequest();
      return json({
        success: true,
        sessions: sessions || [],
        total: count || 0,
        page,
        limit,
      });
    }

    statusCode = 400; errorMessage = `Unknown action: ${action}`; await logRequest();
    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("merchant-payment-api error:", err);
    statusCode = 500; errorMessage = String(err); await logRequest();
    return json({ error: "Internal server error" }, 500);
  }
});

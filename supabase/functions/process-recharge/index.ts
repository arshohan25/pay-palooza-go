import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { operator, phone, amount, pack_name } = await req.json();

    // Validate inputs
    if (!operator || !phone || !amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "Missing required fields: operator, phone, amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof phone !== "string" || !/^[0-9]{11}$/.test(phone)) {
      return new Response(JSON.stringify({ error: "Invalid phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (amount > 1000) {
      return new Response(JSON.stringify({ error: "Amount exceeds maximum ৳1,000" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch operator API config
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: cfg, error: cfgErr } = await adminClient
      .from("recharge_api_configs")
      .select("*")
      .eq("operator", operator)
      .eq("is_enabled", true)
      .single();

    if (cfgErr || !cfg) {
      return new Response(JSON.stringify({ error: "Operator API not configured or disabled", api_available: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiBaseUrl = (cfg as any).api_base_url;
    const config = (cfg as any).config as Record<string, string>;

    if (!apiBaseUrl) {
      return new Response(JSON.stringify({ error: "No API endpoint configured", api_available: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send recharge request to operator API
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const rechargePayload = {
        phone,
        amount,
        pack_name: pack_name || undefined,
        merchant_id: config.MERCHANT_ID || undefined,
        api_key: config.API_KEY || undefined,
        timestamp: new Date().toISOString(),
      };

      const resp = await fetch(`${apiBaseUrl}/recharge`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": config.API_KEY ? `Bearer ${config.API_KEY}` : "",
          "X-API-Secret": config.API_SECRET || "",
          "User-Agent": "EasyPay-Recharge/1.0",
        },
        body: JSON.stringify(rechargePayload),
      });
      clearTimeout(timeout);

      const respText = await resp.text();
      let respData: any = {};
      try { respData = JSON.parse(respText); } catch { /* non-JSON response */ }

      if (resp.ok) {
        return new Response(
          JSON.stringify({
            success: true,
            api_available: true,
            operator_txn_id: respData.transaction_id || respData.txn_id || respData.id || null,
            message: respData.message || "Recharge processed successfully",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            api_available: true,
            error: respData.message || respData.error || `API returned ${resp.status}`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (e: any) {
      const errorMsg = e.name === "AbortError" ? "Request timed out" : (e.message || "API call failed");
      return new Response(
        JSON.stringify({ success: false, api_available: true, error: errorMsg }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

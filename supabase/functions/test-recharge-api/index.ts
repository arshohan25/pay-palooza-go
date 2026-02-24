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

    // Verify the caller is admin
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
    const userId = claimsData.claims.sub;

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { config_id } = await req.json();
    if (!config_id) {
      return new Response(JSON.stringify({ error: "config_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the config
    const { data: cfg, error: cfgErr } = await adminClient
      .from("recharge_api_configs")
      .select("*")
      .eq("id", config_id)
      .single();

    if (cfgErr || !cfg) {
      return new Response(JSON.stringify({ error: "Config not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiBaseUrl = (cfg as any).api_base_url;
    let testSuccess = false;
    let testError = "";

    if (!apiBaseUrl) {
      testError = "No API Base URL configured";
    } else {
      // Attempt a health-check ping to the base URL
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(apiBaseUrl, {
          method: "GET",
          signal: controller.signal,
          headers: { "User-Agent": "EasyPay-RechargeTest/1.0" },
        });
        clearTimeout(timeout);
        // Consider 2xx or 4xx (auth error = server reachable) as reachable
        testSuccess = resp.status < 500;
        if (!testSuccess) {
          testError = `Server returned ${resp.status}`;
        }
        await resp.text(); // consume body
      } catch (e: any) {
        testError = e.name === "AbortError" ? "Connection timed out" : (e.message || "Connection failed");
      }
    }

    // Update the test results
    await adminClient
      .from("recharge_api_configs")
      .update({
        last_tested: new Date().toISOString(),
        test_status: testSuccess ? "success" : "failed",
      })
      .eq("id", config_id);

    return new Response(
      JSON.stringify({ success: testSuccess, error: testError || undefined }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

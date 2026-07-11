import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const amt = Number(body?.amount);
    if (!Number.isFinite(amt) || amt < 10 || amt > 100000) return json({ error: "Invalid amount" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Create pending fund_request; IPN will approve it.
    const { data: fr, error: frErr } = await admin
      .from("fund_requests")
      .insert({
        user_id: userId,
        type: "add_money",
        amount: amt,
        source_method: "uddoktapay",
        status: "pending",
      })
      .select("id")
      .single();
    if (frErr || !fr) return json({ error: frErr?.message ?? "Failed to create request" }, 500);

    const { data: profile } = await admin
      .from("profiles")
      .select("name,phone,email")
      .eq("user_id", userId)
      .maybeSingle();

    const origin = req.headers.get("origin")
      ?? new URL(req.url).origin.replace(/functions\..*/, "");
    const returnBase = sanitizeReturnOrigin(body?.return_origin || origin || "https://app.local");

    const apiKey = Deno.env.get("UDDOKTAPAY_API_KEY")!;
    const baseUrl = (Deno.env.get("UDDOKTAPAY_BASE_URL") ?? "").replace(/\/$/, "");

    const payload = {
      full_name: profile?.name || "Customer",
      email: profile?.email || `${userId}@easypay.app`,
      amount: amt.toFixed(2),
      metadata: {
        kind: "addmoney",
        request_id: fr.id,
        user_id: userId,
      },
      redirect_url: `${returnBase}/payment-return?addmoney=success&provider=uddoktapay&request_id=${fr.id}`,
      return_type: "GET",
      cancel_url: `${returnBase}/?addmoney=cancel&provider=uddoktapay&request_id=${fr.id}`,
      webhook_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/uddoktapay-ipn`,
    };

    const resp = await fetch(`${baseUrl}/checkout-v2`, {
      method: "POST",
      headers: {
        "RT-UDDOKTAPAY-API-KEY": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data?.status !== true || !data?.payment_url) {
      console.error("uddoktapay-addmoney-init failed", resp.status, data);
      return json({ error: data?.message ?? "Failed to create checkout" }, 502);
    }
    return json({ payment_url: data.payment_url, request_id: fr.id });
  } catch (e) {
    console.error("uddoktapay-addmoney-init error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeReturnOrigin(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Invalid return origin");
    return url.origin;
  } catch {
    return "https://app.local";
  }
}

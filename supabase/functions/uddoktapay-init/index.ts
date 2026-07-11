import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const { short_code, amount } = body ?? {};
    if (typeof short_code !== "string" || !short_code) return json({ error: "short_code required" }, 400);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return json({ error: "Invalid amount" }, 400);

    // Load link via service role (link data is public via short_code anyway).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: link, error: linkErr } = await admin
      .from("payment_links")
      .select("id,title,amount,amount_paid,currency,short_code,is_active,used_count,max_uses,expires_at,created_by")
      .eq("short_code", short_code)
      .maybeSingle();
    if (linkErr || !link) return json({ error: "Link not found" }, 404);
    if (!link.is_active) return json({ error: "Link inactive" }, 400);
    if (link.expires_at && new Date(link.expires_at) < new Date()) return json({ error: "Link expired" }, 400);
    if (link.max_uses != null && link.used_count >= link.max_uses) return json({ error: "Link exhausted" }, 400);
    if (link.amount != null) {
      const remaining = Math.max(Number(link.amount) - Number(link.amount_paid ?? 0), 0);
      if (remaining <= 0) return json({ error: "Link fully paid" }, 400);
      if (amt > remaining) return json({ error: `Only ৳${remaining} remaining` }, 400);
    }

    // Look up payer profile for name / email
    const { data: profile } = await admin
      .from("profiles")
      .select("name,phone,email")
      .eq("user_id", userId)
      .maybeSingle();

    const origin = req.headers.get("origin")
      ?? new URL(req.url).origin.replace(/functions\..*/, "");
    const returnBase = body?.return_origin || origin || "https://app.local";

    const apiKey = Deno.env.get("UDDOKTAPAY_API_KEY")!;
    const baseUrl = (Deno.env.get("UDDOKTAPAY_BASE_URL") ?? "").replace(/\/$/, "");

    const payload = {
      full_name: profile?.name || "Customer",
      email: profile?.email || `${userId}@easypay.app`,
      amount: amt.toFixed(2),
      metadata: {
        link_id: link.id,
        payer_id: userId,
        payee_id: link.created_by,
        short_code: link.short_code,
      },
      redirect_url: `${returnBase}/r/${link.short_code}?up=success`,
      cancel_url: `${returnBase}/r/${link.short_code}?up=cancel`,
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
      console.error("uddoktapay init failed", resp.status, data);
      return json({ error: data?.message ?? "Failed to create checkout" }, 502);
    }
    return json({ payment_url: data.payment_url });
  } catch (e) {
    console.error("uddoktapay-init error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

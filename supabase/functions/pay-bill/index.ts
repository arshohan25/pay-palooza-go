import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (uErr || !user) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => null);
    if (!body) return json(400, { error: "Invalid JSON" });
    const { biller_code, biller_name, account_no, amount, reference } = body as Record<string, any>;

    if (!account_no || !amount || !reference || (!biller_code && !biller_name)) {
      return json(400, { error: "Missing required fields" });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return json(400, { error: "Invalid amount" });

    const admin = createClient(supabaseUrl, svcKey);

    // Resolve biller config (by biller_code preferred, else by display_name)
    let query = admin.from("biller_api_configs").select("*").eq("is_enabled", true).limit(1);
    query = biller_code ? query.eq("biller_code", biller_code) : query.eq("display_name", biller_name);
    const { data: biller } = await query.maybeSingle();

    // If no live config, keep settlement queued (record_transaction already created it)
    if (!biller || !biller.api_base_url) {
      await admin
        .from("biller_settlements")
        .update({ status: "queued", admin_note: "No live provider configured. Awaiting manual settlement." })
        .eq("reference", reference);
      return json(200, { success: true, queued: true, message: "Bill queued for manual settlement." });
    }

    // Build headers from biller.config (api_key, secret, custom headers)
    const cfg = (biller.config ?? {}) as Record<string, string>;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cfg.api_key) headers["Authorization"] = `Bearer ${cfg.api_key}`;
    if (cfg.api_key_header) headers[cfg.api_key_header] = cfg.api_key ?? "";
    for (const [k, v] of Object.entries(cfg)) {
      if (k.startsWith("header_") && typeof v === "string") headers[k.replace("header_", "")] = v;
    }

    // Provider request
    const providerUrl = `${biller.api_base_url.replace(/\/+$/, "")}/pay`;
    let provider_ref: string | null = null;
    let providerOk = false;
    let providerMsg = "";

    try {
      const res = await fetch(providerUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          account: account_no,
          amount: amt,
          reference,
          biller_code: biller.biller_code,
        }),
      });
      const text = await res.text();
      let parsed: any = {};
      try { parsed = JSON.parse(text); } catch { /* keep text */ }
      providerOk = res.ok && (parsed?.status === "success" || parsed?.success === true || res.status < 300);
      provider_ref = parsed?.provider_ref ?? parsed?.transaction_id ?? parsed?.txn_id ?? null;
      providerMsg = parsed?.message ?? text.slice(0, 200);
    } catch (e: any) {
      providerMsg = e?.message ?? "Provider unreachable";
    }

    if (providerOk) {
      await admin
        .from("biller_settlements")
        .update({
          status: "paid",
          provider_ref,
          paid_at: new Date().toISOString(),
          paid_by: user.id,
          admin_note: providerMsg || null,
        })
        .eq("reference", reference);
      return json(200, { success: true, provider_ref, message: "Bill paid to provider." });
    }

    // Provider failed — mark settlement failed for admin review (funds still debited from agent; reversal is manual)
    await admin
      .from("biller_settlements")
      .update({ status: "failed", admin_note: providerMsg || "Provider rejected payment" })
      .eq("reference", reference);
    return json(502, { success: false, error: providerMsg || "Provider payment failed" });
  } catch (err: any) {
    console.error("pay-bill error:", err);
    return json(500, { error: err?.message ?? "Internal error" });
  }
});

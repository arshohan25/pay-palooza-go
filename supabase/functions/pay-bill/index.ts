import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 2, delayMs = 400) {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      // Retry on network-adjacent failures (502/503/504) but never on 4xx (client-visible) or 200.
      if (res.status >= 500 && res.status !== 501 && i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr ?? new Error("Provider unreachable");
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
      authHeader.replace("Bearer ", ""),
    );
    if (uErr || !user) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => null);
    if (!body) return json(400, { error: "Invalid JSON" });
    const { biller_code, biller_name, account_no, amount, reference } = body as Record<string, any>;
    const idemHeader = req.headers.get("idempotency-key") ?? body.idempotency_key ?? null;

    if (!account_no || !amount || !reference || (!biller_code && !biller_name)) {
      return json(400, { error: "Missing required fields" });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return json(400, { error: "Invalid amount" });

    // Deterministic idempotency key: header/body value else hash(user+ref+amount+biller)
    const idem = idemHeader ??
      "pb_" + (await sha256(`${user.id}|${reference}|${amt}|${biller_code ?? biller_name}|${account_no}`));

    const admin = createClient(supabaseUrl, svcKey);

    // --- Idempotency short-circuit ---
    const { data: existing } = await admin
      .from("biller_settlements")
      .select("id, transaction_id, status, provider_ref, admin_note, provider_attempts, updated_at")
      .eq("idempotency_key", idem)
      .maybeSingle();

    if (existing) {
      if (existing.status === "paid") {
        return json(200, {
          success: true,
          idempotent: true,
          provider_ref: existing.provider_ref,
          message: "Bill already paid to provider (idempotent replay).",
        });
      }
      // In-flight guard: reject rapid duplicate submits while an attempt is running
      const inFlight = existing.status === "pending" &&
        existing.updated_at &&
        Date.now() - new Date(existing.updated_at).getTime() < 30_000 &&
        (existing.provider_attempts ?? 0) > 0;
      if (inFlight) {
        return json(409, {
          success: false,
          idempotent: true,
          error: "A provider request for this reference is already in flight.",
        });
      }
    }

    // Attach the idempotency key to the settlement row created by record_transaction.
    await admin
      .from("biller_settlements")
      .update({ idempotency_key: idem })
      .eq("reference", reference)
      .is("idempotency_key", null);

    // Resolve biller config
    let query = admin.from("biller_api_configs").select("*").eq("is_enabled", true).limit(1);
    query = biller_code ? query.eq("biller_code", biller_code) : query.eq("display_name", biller_name);
    const { data: biller } = await query.maybeSingle();

    // No live config → queue for manual settlement
    if (!biller || !biller.api_base_url) {
      await admin
        .from("biller_settlements")
        .update({
          status: "queued",
          admin_note: "No live provider configured. Awaiting manual settlement.",
          idempotency_key: idem,
        })
        .eq("reference", reference);
      return json(200, { success: true, queued: true, idempotent: false, message: "Bill queued for manual settlement." });
    }

    // Bump attempts + stamp last_attempt_at BEFORE calling the provider
    await admin
      .from("biller_settlements")
      .update({
        provider_attempts: (existing?.provider_attempts ?? 0) + 1,
        last_attempt_at: new Date().toISOString(),
        idempotency_key: idem,
      })
      .eq("reference", reference);

    // Build headers
    const cfg = (biller.config ?? {}) as Record<string, string>;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Idempotency-Key": idem, // pass through — mature providers honor this
    };
    if (cfg.api_key) headers["Authorization"] = `Bearer ${cfg.api_key}`;
    if (cfg.api_key_header) headers[cfg.api_key_header] = cfg.api_key ?? "";
    for (const [k, v] of Object.entries(cfg)) {
      if (k.startsWith("header_") && typeof v === "string") headers[k.replace("header_", "")] = v;
    }

    const providerUrl = `${biller.api_base_url.replace(/\/+$/, "")}/pay`;
    let provider_ref: string | null = null;
    let providerOk = false;
    let providerMsg = "";

    try {
      const res = await fetchWithRetry(providerUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          account: account_no,
          amount: amt,
          reference,
          idempotency_key: idem,
          biller_code: biller.biller_code,
        }),
      }, 2, 500);
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
      return json(200, { success: true, provider_ref, idempotent: false, message: "Bill paid to provider." });
    }

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

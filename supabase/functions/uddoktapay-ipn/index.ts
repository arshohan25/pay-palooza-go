import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Public webhook: UddoktaPay POSTs here with an RT-UDDOKTAPAY-API-KEY header.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("UDDOKTAPAY_API_KEY")!;
    const baseUrl = (Deno.env.get("UDDOKTAPAY_BASE_URL") ?? "").replace(/\/$/, "");
    const incomingKey = req.headers.get("RT-UDDOKTAPAY-API-KEY") ?? req.headers.get("rt-uddoktapay-api-key");
    if (!incomingKey || incomingKey !== apiKey) {
      console.warn("uddoktapay-ipn: invalid api key header");
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const invoiceId: string | undefined = body?.invoice_id;
    if (!invoiceId) return json({ error: "invoice_id missing" }, 400);

    // Re-verify with UddoktaPay to prevent spoofing.
    const verifyResp = await fetch(`${baseUrl}/verify-payment`, {
      method: "POST",
      headers: {
        "RT-UDDOKTAPAY-API-KEY": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ invoice_id: invoiceId }),
    });
    const verified = await verifyResp.json().catch(() => ({}));
    if (!verifyResp.ok) {
      console.error("uddoktapay verify failed", verifyResp.status, verified);
      return json({ error: "verify failed" }, 502);
    }

    const status = String(verified?.status ?? "").toUpperCase();
    const metadata = verified?.metadata ?? {};
    const amount = Number(verified?.amount ?? 0);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Branch: add-money top-up vs payment-link
    if (metadata?.kind === "addmoney") {
      const requestId = metadata?.request_id;
      if (!requestId) return json({ error: "request_id missing" }, 400);
      if (status !== "COMPLETED") {
        console.log("uddoktapay-ipn addmoney non-terminal", status);
        return json({ ok: true, status });
      }
      const gatewayTrxId: string | null =
        verified?.transaction_id ?? verified?.trx_id ?? verified?.trxID ?? null;
      // Load the request so we can verify the gateway amount matches.
      const { data: fr } = await admin
        .from("fund_requests")
        .select("id,amount,status")
        .eq("id", requestId)
        .maybeSingle();
      if (!fr) return json({ error: "Request not found" }, 404);
      if (!Number.isFinite(amount) || Math.abs(amount - Number(fr.amount)) > 0.01) {
        console.error("uddoktapay-ipn amount mismatch", { paid: amount, expected: fr.amount, requestId });
        await admin
          .from("fund_requests")
          .update({
            admin_note:
              `[uddoktapay amount mismatch: paid=${amount} expected=${fr.amount} invoice=${invoiceId} trx=${gatewayTrxId ?? "-"}]`,
          })
          .eq("id", requestId);
        return json({ ok: false, error: "amount_mismatch" }, 409);
      }
      const gatewayRef = gatewayTrxId ? `invoice=${invoiceId} trx=${gatewayTrxId}` : String(invoiceId);
      const { data, error } = await admin.rpc("system_approve_addmoney_request", {
        p_request_id: requestId,
        p_gateway_ref: gatewayRef,
      });
      if (error) {
        console.error("system_approve_addmoney_request failed", error);
        return json({ error: error.message }, 500);
      }
      if (gatewayTrxId) {
        await admin
          .from("fund_requests")
          .update({ transaction_id_proof: String(gatewayTrxId) })
          .eq("id", requestId);
      }
      return json({ ok: true, addmoney: data, gateway_trx_id: gatewayTrxId });
    }

    const linkId = metadata?.link_id;
    const payerId = metadata?.payer_id;
    const payeeId = metadata?.payee_id;
    if (!linkId || !payerId || !payeeId || !Number.isFinite(amount) || amount <= 0) {
      console.error("uddoktapay-ipn: missing metadata", { linkId, payerId, payeeId, amount });
      return json({ error: "invalid metadata" }, 400);
    }

    const idemKey = `uddoktapay:${invoiceId}`;
    const { data: existing } = await admin
      .from("payment_link_payments")
      .select("id,status")
      .eq("idempotency_key", idemKey)
      .maybeSingle();
    if (existing) {
      console.log("uddoktapay-ipn: already processed", invoiceId, existing.status);
      return json({ ok: true, already: true });
    }

    if (status !== "COMPLETED") {
      console.log("uddoktapay-ipn: non-terminal status", status);
      return json({ ok: true, status });
    }

    const { data: link } = await admin
      .from("payment_links")
      .select("currency")
      .eq("id", linkId)
      .maybeSingle();

    const { error: insertErr } = await admin.from("payment_link_payments").insert({
      link_id: linkId,
      payer_id: payerId,
      payee_id: payeeId,
      amount,
      currency: link?.currency ?? "BDT",
      status: "succeeded",
      idempotency_key: idemKey,
    });
    if (insertErr) {
      console.error("uddoktapay-ipn insert failed", insertErr);
      return json({ error: insertErr.message }, 500);
    }

    return json({ ok: true });

  } catch (e) {
    console.error("uddoktapay-ipn error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

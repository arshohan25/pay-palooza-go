import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const jsonRes = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Poll a pending idempotency row until it resolves (max ~5s)
async function waitForIdempotentResult(admin: ReturnType<typeof createClient>, actorId: string, key: string) {
  for (let i = 0; i < 25; i++) {
    const { data } = await admin
      .from("payment_link_refund_idempotency")
      .select("status, response, error")
      .eq("actor_id", actorId)
      .eq("idempotency_key", key)
      .maybeSingle();
    if (data && data.status !== "pending") return data;
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);

    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) return jsonRes({ error: "Not authenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const paymentId: string | undefined = body?.payment_id;
    const reason: string = typeof body?.reason === "string" ? body.reason.slice(0, 500) : "";
    const amountInput: number | undefined =
      typeof body?.amount === "number" && Number.isFinite(body.amount) ? body.amount : undefined;
    const idempotencyKey: string | undefined =
      (typeof body?.idempotency_key === "string" && body.idempotency_key.trim()) ||
      req.headers.get("idempotency-key") ||
      undefined;

    if (!paymentId) return jsonRes({ error: "Missing payment_id" }, 400);
    if (amountInput != null && amountInput <= 0) {
      return jsonRes({ error: "Refund amount must be positive" }, 400);
    }
    if (idempotencyKey && (idempotencyKey.length < 8 || idempotencyKey.length > 200)) {
      return jsonRes({ error: "Invalid idempotency_key" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: userErr } = await admin.auth.getUser(authHeader);
    if (userErr || !user) return jsonRes({ error: "Invalid session" }, 401);

    // --- Idempotency claim ---
    // Try to insert a "pending" row for (actor, key). If it conflicts, another request
    // is either in-flight or already finished — return its stored result.
    if (idempotencyKey) {
      const { error: claimErr } = await admin
        .from("payment_link_refund_idempotency")
        .insert({
          actor_id: user.id,
          idempotency_key: idempotencyKey,
          payment_id: paymentId,
          requested_amount: amountInput ?? null,
          status: "pending",
        });
      if (claimErr) {
        // Unique violation → another request already owns this key
        const prior = await waitForIdempotentResult(admin, user.id, idempotencyKey);
        if (!prior) return jsonRes({ error: "Refund still processing, retry later" }, 409);
        if (prior.status === "succeeded") {
          return jsonRes({ replayed: true, ...(prior.response as object ?? {}) });
        }
        return jsonRes({ replayed: true, error: prior.error ?? "Prior refund failed" }, 400);
      }
    }

    const finalize = async (payload: object, status: number, ok: boolean, errText?: string) => {
      if (idempotencyKey) {
        await admin
          .from("payment_link_refund_idempotency")
          .update({
            status: ok ? "succeeded" : "failed",
            response: ok ? payload : null,
            error: ok ? null : (errText ?? "failed"),
            completed_at: new Date().toISOString(),
          })
          .eq("actor_id", user.id)
          .eq("idempotency_key", idempotencyKey);
      }
      return jsonRes(payload, status);
    };

    // Load the payment + link
    const { data: pay, error: payErr } = await admin
      .from("payment_link_payments")
      .select("id, link_id, payer_id, payee_id, amount, currency, status, transaction_id, refunded_amount")
      .eq("id", paymentId)
      .maybeSingle();
    if (payErr) return finalize({ error: payErr.message }, 500, false, payErr.message);
    if (!pay) return finalize({ error: "Payment not found" }, 404, false, "not_found");
    if (pay.payee_id !== user.id) return finalize({ error: "Only the payee can refund" }, 403, false, "forbidden");
    if (pay.status !== "succeeded" && pay.status !== "partially_refunded") {
      return finalize({ error: `Payment cannot be refunded (${pay.status})` }, 400, false, "bad_status");
    }

    const paidAmount = Number(pay.amount);
    const alreadyRefunded = Number(pay.refunded_amount ?? 0);
    const refundable = Math.max(paidAmount - alreadyRefunded, 0);
    if (refundable <= 0) return finalize({ error: "Payment already fully refunded" }, 400, false, "fully_refunded");

    const amount = amountInput ?? refundable;
    if (!Number.isFinite(amount) || amount <= 0) return finalize({ error: "Invalid refund amount" }, 400, false, "invalid_amount");
    if (amount > refundable + 0.00001) {
      return finalize({ error: `Refund amount exceeds refundable balance (৳${refundable})` }, 400, false, "over_refund");
    }

    const { data: link } = await admin
      .from("payment_links")
      .select("id, title, short_code")
      .eq("id", pay.link_id)
      .maybeSingle();

    const { data: payeeProfile } = await admin
      .from("profiles")
      .select("balance, name, phone, status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!payeeProfile) return finalize({ error: "Payee profile not found" }, 400, false, "no_profile");
    if (payeeProfile.status && payeeProfile.status !== "active") {
      return finalize({ error: "Account not active" }, 403, false, "inactive");
    }
    if (Number(payeeProfile.balance) < amount) {
      return finalize({ error: "Insufficient balance to refund" }, 400, false, "insufficient");
    }

    const { data: payerProfile } = await admin
      .from("profiles")
      .select("name, phone")
      .eq("user_id", pay.payer_id)
      .maybeSingle();

    // 1. Debit the payee (the refunder)
    const { data: newPayeeBal, error: debitErr } = await admin.rpc("debit_user_balance", {
      p_user_id: user.id,
      p_amount: amount,
    });
    if (debitErr) return finalize({ error: debitErr.message }, 400, false, debitErr.message);

    // 2. Credit the original payer
    const { error: creditErr } = await admin.rpc("credit_user_balance", {
      p_user_id: pay.payer_id,
      p_amount: amount,
    });
    if (creditErr) {
      await admin.rpc("credit_user_balance", { p_user_id: user.id, p_amount: amount });
      return finalize({ error: creditErr.message }, 500, false, creditErr.message);
    }

    const reference = `RF-${link?.short_code ?? "PL"}-${Date.now().toString(36).toUpperCase()}`;

    const { data: refundTxn } = await admin
      .from("transactions")
      .insert({
        user_id: user.id,
        type: "refund",
        amount,
        recipient_phone: payerProfile?.phone,
        recipient_name: payerProfile?.name,
        description: `Refund: ${link?.title ?? "payment link"}`,
        reference,
        balance_after: newPayeeBal,
      })
      .select("id")
      .single();

    await admin.from("transactions").insert({
      user_id: pay.payer_id,
      type: "receive",
      amount,
      recipient_phone: payeeProfile.phone,
      recipient_name: payeeProfile.name,
      description: `Refund: ${link?.title ?? "payment link"}`,
      reference,
    });

    const { data: rpcResult, error: rpcErr } = await admin.rpc("refund_payment_link_payment", {
      p_payment_id: pay.id,
      p_actor: user.id,
      p_reason: reason || null,
      p_refund_txn_id: refundTxn?.id ?? null,
      p_amount: amount,
    });

    if (rpcErr) {
      await admin.rpc("credit_user_balance", { p_user_id: user.id, p_amount: amount });
      await admin.rpc("debit_user_balance", { p_user_id: pay.payer_id, p_amount: amount });
      if (refundTxn?.id) await admin.from("transactions").delete().eq("id", refundTxn.id);
      await admin.from("transactions").delete().eq("reference", reference).eq("user_id", pay.payer_id);
      return finalize({ error: rpcErr.message }, 400, false, rpcErr.message);
    }

    const payload = {
      success: true,
      amount,
      currency: pay.currency,
      reference,
      new_balance: Number(newPayeeBal),
      ...(rpcResult as object ?? {}),
    };
    return finalize(payload, 200, true);
  } catch (e) {
    console.error("refund-link-payment error", e);
    return jsonRes({ error: (e as Error).message ?? "Unexpected error" }, 500);
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const jsonRes = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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

    if (!paymentId) return jsonRes({ error: "Missing payment_id" }, 400);
    if (amountInput != null && amountInput <= 0) {
      return jsonRes({ error: "Refund amount must be positive" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: userErr } = await admin.auth.getUser(authHeader);
    if (userErr || !user) return jsonRes({ error: "Invalid session" }, 401);

    // Load the payment + link
    const { data: pay, error: payErr } = await admin
      .from("payment_link_payments")
      .select("id, link_id, payer_id, payee_id, amount, currency, status, transaction_id, refunded_amount")
      .eq("id", paymentId)
      .maybeSingle();
    if (payErr) return jsonRes({ error: payErr.message }, 500);
    if (!pay) return jsonRes({ error: "Payment not found" }, 404);
    if (pay.payee_id !== user.id) return jsonRes({ error: "Only the payee can refund" }, 403);
    if (pay.status !== "succeeded" && pay.status !== "partially_refunded") {
      return jsonRes({ error: `Payment cannot be refunded (${pay.status})` }, 400);
    }

    const paidAmount = Number(pay.amount);
    const alreadyRefunded = Number(pay.refunded_amount ?? 0);
    const refundable = Math.max(paidAmount - alreadyRefunded, 0);
    if (refundable <= 0) return jsonRes({ error: "Payment already fully refunded" }, 400);

    const amount = amountInput ?? refundable;
    if (!Number.isFinite(amount) || amount <= 0) return jsonRes({ error: "Invalid refund amount" }, 400);
    if (amount > refundable + 0.00001) {
      return jsonRes({ error: `Refund amount exceeds refundable balance (৳${refundable})` }, 400);
    }


    const { data: link } = await admin
      .from("payment_links")
      .select("id, title, short_code")
      .eq("id", pay.link_id)
      .maybeSingle();

    // Ensure payee (the one refunding) has enough balance to return
    const { data: payeeProfile } = await admin
      .from("profiles")
      .select("balance, name, phone, status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!payeeProfile) return jsonRes({ error: "Payee profile not found" }, 400);
    if (payeeProfile.status && payeeProfile.status !== "active") {
      return jsonRes({ error: "Account not active" }, 403);
    }
    if (Number(payeeProfile.balance) < amount) {
      return jsonRes({ error: "Insufficient balance to refund" }, 400);
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
    if (debitErr) return jsonRes({ error: debitErr.message }, 400);

    // 2. Credit the original payer
    const { error: creditErr } = await admin.rpc("credit_user_balance", {
      p_user_id: pay.payer_id,
      p_amount: amount,
    });
    if (creditErr) {
      await admin.rpc("credit_user_balance", { p_user_id: user.id, p_amount: amount });
      return jsonRes({ error: creditErr.message }, 500);
    }

    const reference = `RF-${link?.short_code ?? "PL"}-${Date.now().toString(36).toUpperCase()}`;

    // 3. Reversal transactions
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

    // 4. RPC updates payment_link_payments + payment_links atomically and notifies both parties
    const { data: rpcResult, error: rpcErr } = await admin.rpc("refund_payment_link_payment", {
      p_payment_id: pay.id,
      p_actor: user.id,
      p_reason: reason || null,
      p_refund_txn_id: refundTxn?.id ?? null,
      p_amount: amount,
    });

    if (rpcErr) {
      // Best-effort rollback of the wallet movement
      await admin.rpc("credit_user_balance", { p_user_id: user.id, p_amount: amount });
      await admin.rpc("debit_user_balance", { p_user_id: pay.payer_id, p_amount: amount });
      if (refundTxn?.id) await admin.from("transactions").delete().eq("id", refundTxn.id);
      await admin.from("transactions").delete().eq("reference", reference).eq("user_id", pay.payer_id);
      return jsonRes({ error: rpcErr.message }, 400);
    }

    return jsonRes({
      success: true,
      amount,
      currency: pay.currency,
      reference,
      new_balance: Number(newPayeeBal),
      ...(rpcResult as object ?? {}),
    });
  } catch (e) {
    console.error("refund-link-payment error", e);
    return jsonRes({ error: (e as Error).message ?? "Unexpected error" }, 500);
  }
});

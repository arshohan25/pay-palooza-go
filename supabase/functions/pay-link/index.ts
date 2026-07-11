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
    const shortCode: string | undefined = body?.short_code;
    const amountInput: number | undefined =
      typeof body?.amount === "number" ? body.amount : undefined;

    if (!shortCode || typeof shortCode !== "string") {
      return jsonRes({ error: "Missing short_code" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(authHeader);
    if (userErr || !user) return jsonRes({ error: "Invalid session" }, 401);

    // 1. Load link
    const { data: link, error: linkErr } = await admin
      .from("payment_links")
      .select("*")
      .eq("short_code", shortCode)
      .maybeSingle();
    if (linkErr) return jsonRes({ error: linkErr.message }, 500);
    if (!link) return jsonRes({ error: "Payment link not found" }, 404);
    if (!link.is_active) return jsonRes({ error: "Link is inactive" }, 400);
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return jsonRes({ error: "Link expired" }, 400);
    }
    if (link.max_uses != null && link.used_count >= link.max_uses) {
      return jsonRes({ error: "Link fully redeemed" }, 400);
    }
    if (!link.created_by) return jsonRes({ error: "Link has no payee" }, 400);
    if (link.created_by === user.id) {
      return jsonRes({ error: "You cannot pay your own link" }, 400);
    }

    // 2. Resolve amount
    const amount =
      link.amount != null ? Number(link.amount) : amountInput ?? 0;
    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonRes({ error: "Invalid amount" }, 400);
    }

    // 3. Check payer balance
    const { data: payerProfile, error: pErr } = await admin
      .from("profiles")
      .select("user_id, balance, name, phone, status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (pErr || !payerProfile) return jsonRes({ error: "Payer profile not found" }, 400);
    if (payerProfile.status && payerProfile.status !== "active") {
      return jsonRes({ error: "Account not active" }, 403);
    }
    if (Number(payerProfile.balance) < amount) {
      return jsonRes({ error: "Insufficient balance" }, 400);
    }

    const { data: payeeProfile } = await admin
      .from("profiles")
      .select("user_id, name, phone")
      .eq("user_id", link.created_by)
      .maybeSingle();
    if (!payeeProfile) return jsonRes({ error: "Payee not found" }, 400);

    // 4. Atomic debit/credit via RPCs
    const { data: newPayerBal, error: debitErr } = await admin.rpc(
      "debit_user_balance",
      { p_user_id: user.id, p_amount: amount },
    );
    if (debitErr) return jsonRes({ error: debitErr.message }, 400);

    const { error: creditErr } = await admin.rpc("credit_user_balance", {
      p_user_id: link.created_by,
      p_amount: amount,
    });
    if (creditErr) {
      // rollback debit
      await admin.rpc("credit_user_balance", { p_user_id: user.id, p_amount: amount });
      return jsonRes({ error: creditErr.message }, 500);
    }

    // 5. Insert transactions (payer=payment, payee=receive)
    const reference = `PL-${link.short_code}`;
    const { data: payerTxn } = await admin
      .from("transactions")
      .insert({
        user_id: user.id,
        type: "payment",
        amount,
        recipient_phone: payeeProfile.phone,
        recipient_name: payeeProfile.name,
        description: link.title,
        reference,
        balance_after: newPayerBal,
      })
      .select("id")
      .single();

    await admin.from("transactions").insert({
      user_id: link.created_by,
      type: "receive",
      amount,
      recipient_phone: payerProfile.phone,
      recipient_name: payerProfile.name,
      description: link.title,
      reference,
    });

    // 6. Record link payment + bump used_count
    await admin.from("payment_link_payments").insert({
      link_id: link.id,
      payer_id: user.id,
      payee_id: link.created_by,
      amount,
      currency: link.currency ?? "BDT",
      transaction_id: payerTxn?.id ?? null,
      status: "succeeded",
    });

    const nextUsed = (link.used_count ?? 0) + 1;
    const linkUpdate: Record<string, unknown> = { used_count: nextUsed };
    if (link.max_uses != null && nextUsed >= link.max_uses) {
      linkUpdate.is_active = false;
    }
    await admin.from("payment_links").update(linkUpdate).eq("id", link.id);

    return jsonRes({
      success: true,
      amount,
      currency: link.currency ?? "BDT",
      new_balance: Number(newPayerBal),
      reference,
      payee_name: payeeProfile.name,
    });
  } catch (e) {
    console.error("pay-link error", e);
    return jsonRes({ error: (e as Error).message ?? "Unexpected error" }, 500);
  }
});

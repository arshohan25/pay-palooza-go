import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonRes = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, otp_code, pin, recipient_phone, amount, description, reference, merchant_id: clientMerchantId } = await req.json();

    if (!phone || !otp_code || !pin || !amount) {
      return jsonRes({ error: "Missing required fields" }, 400);
    }

    if (!/^\d{4}$/.test(pin)) {
      return jsonRes({ error: "PIN must be 4 digits" }, 400);
    }

    if (amount <= 0 || amount > 100000) {
      return jsonRes({ error: "Amount must be between ৳1 and ৳100,000" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const cleanPhone = phone.replace(/\D/g, "").replace(/^(88)/, "");

    // 1. Verify OTP
    const now = new Date().toISOString();
    const { data: otpRow, error: otpErr } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("phone", cleanPhone)
      .eq("code", otp_code)
      .eq("purpose", "payment")
      .eq("verified", false)
      .gte("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpErr || !otpRow) {
      return jsonRes({ error: "Invalid or expired OTP" }, 400);
    }

    await supabaseAdmin.from("otp_codes").update({ verified: true }).eq("id", otpRow.id);

    // 2. Look up payer
    const { data: payer } = await supabaseAdmin
      .from("profiles")
      .select("user_id, balance, name, phone")
      .eq("phone", cleanPhone)
      .eq("status", "active")
      .single();

    if (!payer) {
      return jsonRes({ error: "Account not found or inactive" }, 400);
    }

    // 3. Verify PIN via auth
    const password = `${pin}EP`;
    const emailDomains = ["easypay.app", "example.com", "easypay.local"];
    let authPassed = false;

    for (const domain of emailDomains) {
      const { error } = await supabaseAdmin.auth.signInWithPassword({
        email: `${cleanPhone}@${domain}`,
        password,
      });
      if (!error) { authPassed = true; break; }
    }

    if (!authPassed) {
      return jsonRes({ error: "Incorrect PIN" }, 400);
    }

    // 4. Resolve recipient — AUTHORITATIVE via payment link reference first
    let recipient: { user_id: string; balance: number; name: string | null; phone: string } | null = null;

    if (reference) {
      console.log("[checkout-guest] Resolving via reference:", reference);

      // Step A: Get payment link
      const { data: paymentLink, error: linkErr } = await supabaseAdmin
        .from("payment_links")
        .select("id, merchant_id, merchant_code")
        .eq("short_code", reference)
        .eq("is_active", true)
        .maybeSingle();

      if (linkErr) {
        console.error("[checkout-guest] payment_links lookup error:", linkErr);
      }

      if (paymentLink) {
        console.log("[checkout-guest] Payment link found:", { id: paymentLink.id, merchant_id: paymentLink.merchant_id, merchant_code: paymentLink.merchant_code });

        // Step B: Get merchant user_id
        let merchantUserId: string | null = null;

        if (paymentLink.merchant_id) {
          const { data: merchantRow, error: mErr } = await supabaseAdmin
            .from("merchants")
            .select("user_id")
            .eq("id", paymentLink.merchant_id)
            .eq("status", "active")
            .maybeSingle();

          if (mErr) console.error("[checkout-guest] merchant lookup by id error:", mErr);
          merchantUserId = merchantRow?.user_id ?? null;
          console.log("[checkout-guest] Merchant by id:", { merchant_id: paymentLink.merchant_id, user_id: merchantUserId });
        }

        if (!merchantUserId && paymentLink.merchant_code) {
          const { data: merchantByCode, error: mcErr } = await supabaseAdmin
            .from("merchants")
            .select("user_id")
            .eq("qr_code_data", paymentLink.merchant_code)
            .eq("status", "active")
            .maybeSingle();

          if (mcErr) console.error("[checkout-guest] merchant lookup by code error:", mcErr);
          merchantUserId = merchantByCode?.user_id ?? null;
          console.log("[checkout-guest] Merchant by code:", { merchant_code: paymentLink.merchant_code, user_id: merchantUserId });
        }

        // Step C: Get recipient profile
        if (merchantUserId) {
          const { data: profile, error: pErr } = await supabaseAdmin
            .from("profiles")
            .select("user_id, balance, name, phone")
            .eq("user_id", merchantUserId)
            .eq("status", "active")
            .maybeSingle();

          if (pErr) console.error("[checkout-guest] profile lookup error:", pErr);
          recipient = profile;
          console.log("[checkout-guest] Recipient profile resolved:", { user_id: profile?.user_id, phone: profile?.phone });
        } else {
          console.error("[checkout-guest] No merchant user_id found for link:", reference);
        }
      } else {
        console.warn("[checkout-guest] No active payment link for short_code:", reference);
      }
    }

    // Fallback: direct phone lookup (for non-link manual payments)
    if (!recipient && recipient_phone) {
      const cleanRecipient = recipient_phone.replace(/\D/g, "").replace(/^(88)/, "");
      console.log("[checkout-guest] Fallback: phone lookup for", cleanRecipient);

      const { data: recipientByPhone, error: recipientErr } = await supabaseAdmin
        .from("profiles")
        .select("user_id, balance, name, phone")
        .eq("phone", cleanRecipient)
        .eq("status", "active")
        .maybeSingle();

      if (recipientErr) console.error("[checkout-guest] Phone fallback error:", recipientErr);
      recipient = recipientByPhone;
    }

    if (!recipient) {
      console.error("[checkout-guest] FINAL: Recipient not found.", { reference, recipient_phone });
      return jsonRes({ error: "Recipient not found. The merchant may be inactive or the payment link is invalid." }, 400);
    }

    // Self-pay guard
    if (payer.user_id === recipient.user_id) {
      return jsonRes({ error: "Cannot pay yourself" }, 400);
    }

    // 5. Check balance
    if (payer.balance < amount) {
      return jsonRes({ error: "Insufficient balance" }, 400);
    }

    // 6. Execute transfer
    const payerNewBalance = payer.balance - amount;
    const recipientNewBalance = recipient.balance + amount;

    const { error: debitErr } = await supabaseAdmin
      .from("profiles")
      .update({ balance: payerNewBalance })
      .eq("user_id", payer.user_id);
    if (debitErr) throw debitErr;

    const { error: creditErr } = await supabaseAdmin
      .from("profiles")
      .update({ balance: recipientNewBalance })
      .eq("user_id", recipient.user_id);
    if (creditErr) throw creditErr;

    // Get merchant name if available
    const { data: merch } = await supabaseAdmin
      .from("merchants")
      .select("business_name")
      .eq("user_id", recipient.user_id)
      .eq("status", "active")
      .maybeSingle();

    const recipientName = merch?.business_name || recipient.name || recipient.phone;
    const payerName = payer.name || cleanPhone;

    // 7. Record transactions
    await supabaseAdmin.from("transactions").insert({
      user_id: payer.user_id,
      type: "payment",
      amount,
      fee: 0,
      balance_after: payerNewBalance,
      recipient_phone: recipient.phone,
      recipient_name: recipientName,
      description: description || `Payment to ${recipientName}`,
      reference: reference || null,
      status: "completed",
    });

    await supabaseAdmin.from("transactions").insert({
      user_id: recipient.user_id,
      type: "payment",
      amount,
      fee: 0,
      balance_after: recipientNewBalance,
      recipient_phone: cleanPhone,
      recipient_name: payerName,
      description: description || `Payment from ${payerName}`,
      reference: reference || null,
      status: "completed",
    });

    // 8. Increment used_count on payment link
    if (reference) {
      const { data: linkRow } = await supabaseAdmin
        .from("payment_links")
        .select("id, used_count")
        .eq("short_code", reference)
        .eq("is_active", true)
        .maybeSingle();
      if (linkRow) {
        await supabaseAdmin
          .from("payment_links")
          .update({ used_count: (linkRow.used_count || 0) + 1 })
          .eq("id", linkRow.id);
      }
    }

    console.log("[checkout-guest] Payment completed:", { payer: cleanPhone, recipient: recipient.phone, amount });
    return jsonRes({ success: true, message: "Payment completed" });
  } catch (err) {
    console.error("checkout-guest error:", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});

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
    const { phone, otp_code, pin, recipient_phone, amount, description, reference } = await req.json();

    if (!phone || !otp_code || !pin || !recipient_phone || !amount) {
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
    const cleanRecipient = recipient_phone.replace(/\D/g, "").replace(/^(88)/, "");

    if (cleanPhone === cleanRecipient) {
      return jsonRes({ error: "Cannot pay yourself" }, 400);
    }

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

    // Mark OTP as verified
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

    // 3. Verify PIN via auth — try all known email domains
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

    // 4. Look up recipient
    const { data: recipient, error: recipientErr } = await supabaseAdmin
      .from("profiles")
      .select("user_id, balance, name, phone")
      .eq("phone", cleanRecipient)
      .eq("status", "active")
      .maybeSingle();

    if (recipientErr || !recipient) {
      console.error("Recipient lookup failed:", { cleanRecipient, recipientErr });
      return jsonRes({ error: "Recipient not found" }, 400);
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

    const recipientName = merch?.business_name || recipient.name || cleanRecipient;
    const payerName = payer.name || cleanPhone;

    // 7. Record transactions
    await supabaseAdmin.from("transactions").insert({
      user_id: payer.user_id,
      type: "payment",
      amount,
      fee: 0,
      balance_after: payerNewBalance,
      recipient_phone: cleanRecipient,
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

    // 8. Increment used_count on payment link if reference matches a short_code
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

    return jsonRes({ success: true, message: "Payment completed" });
  } catch (err) {
    console.error("checkout-guest error:", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});

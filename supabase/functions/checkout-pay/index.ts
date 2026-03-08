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
    const { session_id, phone, otp_code, pin } = await req.json();

    if (!session_id || !phone || !otp_code || !pin) {
      return jsonRes({ error: "Missing required fields" }, 400);
    }

    if (!/^\d{4}$/.test(pin)) {
      return jsonRes({ error: "PIN must be 4 digits" }, 400);
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

    // Mark OTP as verified
    await supabaseAdmin
      .from("otp_codes")
      .update({ verified: true })
      .eq("id", otpRow.id);

    // 2. Load payment session
    const { data: session, error: sessErr } = await supabaseAdmin
      .from("merchant_payment_sessions")
      .select("*")
      .eq("id", session_id)
      .single();

    if (sessErr || !session) {
      return jsonRes({ error: "Payment session not found" }, 404);
    }
    if (session.status !== "pending") {
      return jsonRes({ error: `Session already ${session.status}` }, 400);
    }
    if (new Date(session.expires_at) < new Date()) {
      return jsonRes({ error: "Payment session expired" }, 400);
    }

    // 3. Look up payer profile
    const { data: payer } = await supabaseAdmin
      .from("profiles")
      .select("user_id, balance, name, phone")
      .eq("phone", cleanPhone)
      .eq("status", "active")
      .single();

    if (!payer) {
      return jsonRes({ error: "Account not found or inactive" }, 400);
    }

    // 4. Verify PIN via Supabase Auth sign-in
    const email = `${cleanPhone}@easypay.local`;
    const password = `${pin}EP`;

    const { error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return jsonRes({ error: "Incorrect PIN" }, 400);
    }

    // 5. Look up merchant
    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("id, business_name, user_id")
      .eq("id", session.merchant_id)
      .eq("status", "active")
      .single();

    if (!merchant) {
      return jsonRes({ error: "Merchant not found" }, 400);
    }

    const { data: merchantProfile } = await supabaseAdmin
      .from("profiles")
      .select("user_id, balance, phone, name")
      .eq("user_id", merchant.user_id)
      .single();

    if (!merchantProfile) {
      return jsonRes({ error: "Merchant profile not found" }, 400);
    }

    const amount = session.amount;

    // 6. Check payer balance
    if (payer.balance < amount) {
      return jsonRes({ error: "Insufficient balance" }, 400);
    }

    // 7. Execute transfer
    const payerNewBalance = payer.balance - amount;
    const merchantNewBalance = merchantProfile.balance + amount;

    const { error: debitErr } = await supabaseAdmin
      .from("profiles")
      .update({ balance: payerNewBalance })
      .eq("user_id", payer.user_id);
    if (debitErr) throw debitErr;

    const { error: creditErr } = await supabaseAdmin
      .from("profiles")
      .update({ balance: merchantNewBalance })
      .eq("user_id", merchant.user_id);
    if (creditErr) throw creditErr;

    // Record payer transaction
    await supabaseAdmin.from("transactions").insert({
      user_id: payer.user_id,
      type: "payment",
      amount,
      fee: 0,
      balance_after: payerNewBalance,
      recipient_phone: merchantProfile.phone,
      recipient_name: merchant.business_name,
      description: session.description || `Payment to ${merchant.business_name}`,
      reference: session.reference || session.id,
      status: "completed",
    });

    // Record merchant transaction
    await supabaseAdmin.from("transactions").insert({
      user_id: merchant.user_id,
      type: "payment",
      amount,
      fee: 0,
      balance_after: merchantNewBalance,
      recipient_phone: payer.phone,
      recipient_name: payer.name,
      description: session.description || `Payment from ${payer.name || payer.phone}`,
      reference: session.reference || session.id,
      status: "completed",
    });

    // 8. Update session to completed
    await supabaseAdmin
      .from("merchant_payment_sessions")
      .update({
        status: "completed",
        payer_user_id: payer.user_id,
        customer_phone: cleanPhone,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    // 9. Trigger webhook (fire & forget)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    fetch(`${supabaseUrl}/functions/v1/merchant-payment-webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: session.id }),
    }).catch(() => {});

    return jsonRes({ success: true, message: "Payment completed" });
  } catch (err) {
    console.error("checkout-pay error:", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});

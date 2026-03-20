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
    const { merchant_code, amount, phone, otp_code, pin, note, ref } = await req.json();

    if (!merchant_code || !amount || !phone || !otp_code || !pin) {
      return jsonRes({ error: "Missing required fields" }, 400);
    }

    if (!/^01[3-9]\d{8}$/.test(phone)) {
      return jsonRes({ error: "Invalid phone number" }, 400);
    }

    if (!/^\d{4}$/.test(pin)) {
      return jsonRes({ error: "PIN must be 4 digits" }, 400);
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return jsonRes({ error: "Invalid amount" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Verify OTP
    const now = new Date().toISOString();
    const { data: otpRow, error: otpErr } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("phone", phone)
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

    // 2. Verify PIN via Supabase Auth sign-in
    const email = `${phone}@easypay.app`;
    const password = `${pin}EP`;

    const { error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // Try fallback domains
      let authed = false;
      for (const domain of ["@example.com", "@easypay.local"]) {
        const { error } = await supabaseAdmin.auth.signInWithPassword({
          email: `${phone}${domain}`,
          password,
        });
        if (!error) { authed = true; break; }
      }
      if (!authed) {
        return jsonRes({ error: "Incorrect PIN" }, 400);
      }
    }

    // 3. Look up payer profile
    const { data: payer } = await supabaseAdmin
      .from("profiles")
      .select("user_id, balance, name, phone")
      .eq("phone", phone)
      .eq("status", "active")
      .single();

    if (!payer) {
      return jsonRes({ error: "Account not found or inactive" }, 400);
    }

    // 4. Resolve merchant from merchant_code
    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("id, business_name, user_id, merchant_id")
      .eq("merchant_id", merchant_code)
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

    // 5. Prevent self-payment
    if (payer.user_id === merchant.user_id) {
      return jsonRes({ error: "Cannot pay yourself" }, 400);
    }

    // 6. Check payer balance
    if (payer.balance < parsedAmount) {
      return jsonRes({ error: "Insufficient balance" }, 400);
    }

    // 7. Execute transfer
    const payerNewBalance = payer.balance - parsedAmount;
    const merchantNewBalance = merchantProfile.balance + parsedAmount;

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

    const description = note
      ? `${note}${ref ? ` | Ref: ${ref}` : ""}`
      : `Payment to ${merchant.business_name}${ref ? ` | Ref: ${ref}` : ""}`;

    // Record payer transaction
    await supabaseAdmin.from("transactions").insert({
      user_id: payer.user_id,
      type: "payment",
      amount: parsedAmount,
      fee: 0,
      balance_after: payerNewBalance,
      recipient_phone: merchantProfile.phone,
      recipient_name: merchant.business_name,
      description,
      reference: ref || undefined,
      status: "completed",
    });

    // Record merchant transaction
    await supabaseAdmin.from("transactions").insert({
      user_id: merchant.user_id,
      type: "payment",
      amount: parsedAmount,
      fee: 0,
      balance_after: merchantNewBalance,
      recipient_phone: payer.phone,
      recipient_name: payer.name,
      description: `Payment from ${payer.name || payer.phone}${ref ? ` | Ref: ${ref}` : ""}`,
      reference: ref || undefined,
      status: "completed",
    });

    return jsonRes({
      success: true,
      message: "Payment completed",
      merchant_name: merchant.business_name,
      amount: parsedAmount,
      payer_name: payer.name,
    });
  } catch (err) {
    console.error("checkout-guest error:", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});

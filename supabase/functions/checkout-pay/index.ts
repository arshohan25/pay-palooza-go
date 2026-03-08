import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id, phone, otp_code } = await req.json();

    if (!session_id || !phone || !otp_code) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Normalize phone
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
      return new Response(
        JSON.stringify({ error: "Invalid or expired OTP" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      return new Response(
        JSON.stringify({ error: "Payment session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (session.status !== "pending") {
      return new Response(
        JSON.stringify({ error: `Session already ${session.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Payment session expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Look up payer profile
    const { data: payer } = await supabaseAdmin
      .from("profiles")
      .select("user_id, balance, name, phone")
      .eq("phone", cleanPhone)
      .eq("status", "active")
      .single();

    if (!payer) {
      return new Response(
        JSON.stringify({ error: "Account not found or inactive" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Look up merchant
    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("id, business_name, user_id")
      .eq("id", session.merchant_id)
      .eq("status", "active")
      .single();

    if (!merchant) {
      return new Response(
        JSON.stringify({ error: "Merchant not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: merchantProfile } = await supabaseAdmin
      .from("profiles")
      .select("user_id, balance, phone, name")
      .eq("user_id", merchant.user_id)
      .single();

    if (!merchantProfile) {
      return new Response(
        JSON.stringify({ error: "Merchant profile not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const amount = session.amount;

    // 5. Check payer balance
    if (payer.balance < amount) {
      return new Response(
        JSON.stringify({ error: "Insufficient balance" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Execute transfer atomically
    const payerNewBalance = payer.balance - amount;
    const merchantNewBalance = merchantProfile.balance + amount;

    // Debit payer
    const { error: debitErr } = await supabaseAdmin
      .from("profiles")
      .update({ balance: payerNewBalance })
      .eq("user_id", payer.user_id);

    if (debitErr) throw debitErr;

    // Credit merchant
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

    // 7. Update session to completed
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

    // 8. Trigger webhook (fire & forget)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    fetch(`${supabaseUrl}/functions/v1/merchant-payment-webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: session.id }),
    }).catch(() => {});

    return new Response(
      JSON.stringify({ success: true, message: "Payment completed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("checkout-pay error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

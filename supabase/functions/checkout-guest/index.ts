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
    const {
      phone,
      otp_code,
      pin,
      recipient_phone,
      amount,
      description,
      reference,
      merchant_id: clientMerchantId,
    } = await req.json();

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

    const cleanPhone = String(phone).replace(/\D/g, "").replace(/^88/, "");
    const cleanRecipient = String(recipient_phone ?? "")
      .replace(/\D/g, "")
      .replace(/^88/, "");
    const cleanReference = typeof reference === "string" ? reference.trim().toUpperCase() : "";
    const safeMerchantId = typeof clientMerchantId === "string" ? clientMerchantId.trim() : "";

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

    const { data: payer } = await supabaseAdmin
      .from("profiles")
      .select("user_id, balance, name, phone")
      .eq("phone", cleanPhone)
      .eq("status", "active")
      .single();

    if (!payer) {
      return jsonRes({ error: "Account not found or inactive" }, 400);
    }

    const password = `${pin}EP`;
    const emailDomains = ["easypay.app", "example.com", "easypay.local"];
    let authPassed = false;

    for (const domain of emailDomains) {
      const { error } = await supabaseAdmin.auth.signInWithPassword({
        email: `${cleanPhone}@${domain}`,
        password,
      });
      if (!error) {
        authPassed = true;
        break;
      }
    }

    if (!authPassed) {
      return jsonRes({ error: "Incorrect PIN" }, 400);
    }

    let recipient: { user_id: string; balance: number; name: string | null; phone: string } | null = null;
    let resolvedMerchantId: string | null = null;

    if (cleanReference) {
      console.log("[checkout-guest] Resolving via normalized reference:", cleanReference);

      const { data: paymentLink, error: linkErr } = await supabaseAdmin
        .from("payment_links")
        .select("id, merchant_id, merchant_code, short_code, is_active")
        .eq("short_code", cleanReference)
        .eq("is_active", true)
        .maybeSingle();

      if (linkErr) {
        console.error("[checkout-guest] payment link lookup error:", linkErr);
      }

      if (paymentLink) {
        resolvedMerchantId = paymentLink.merchant_id ?? null;
        console.log("[checkout-guest] Payment link found:", {
          payment_link_id: paymentLink.id,
          short_code: paymentLink.short_code,
          merchant_id: paymentLink.merchant_id,
          merchant_code: paymentLink.merchant_code,
        });
      } else {
        console.warn("[checkout-guest] No active payment link for normalized short_code:", cleanReference);
      }
    }

    if (!resolvedMerchantId && safeMerchantId) {
      resolvedMerchantId = safeMerchantId;
      console.log("[checkout-guest] Falling back to client merchant_id:", safeMerchantId);
    }

    if (resolvedMerchantId) {
      const { data: merchantRow, error: merchantErr } = await supabaseAdmin
        .from("merchants")
        .select("id, user_id, qr_code_data")
        .eq("id", resolvedMerchantId)
        .eq("status", "active")
        .maybeSingle();

      if (merchantErr) {
        console.error("[checkout-guest] merchant lookup by id error:", merchantErr);
      }

      if (merchantRow?.user_id) {
        const { data: merchantProfile, error: profileErr } = await supabaseAdmin
          .from("profiles")
          .select("user_id, balance, name, phone")
          .eq("user_id", merchantRow.user_id)
          .eq("status", "active")
          .maybeSingle();

        if (profileErr) {
          console.error("[checkout-guest] merchant profile lookup error:", profileErr);
        }

        recipient = merchantProfile;
        console.log("[checkout-guest] Recipient resolved from merchant_id:", {
          merchant_id: merchantRow.id,
          merchant_user_id: merchantRow.user_id,
          recipient_phone: merchantProfile?.phone,
        });
      } else {
        console.error("[checkout-guest] Active merchant not found for merchant_id:", resolvedMerchantId);
      }
    }

    if (!recipient && cleanRecipient) {
      console.log("[checkout-guest] Fallback: phone lookup for", cleanRecipient);

      const { data: recipientByPhone, error: recipientErr } = await supabaseAdmin
        .from("profiles")
        .select("user_id, balance, name, phone")
        .eq("phone", cleanRecipient)
        .eq("status", "active")
        .maybeSingle();

      if (recipientErr) {
        console.error("[checkout-guest] phone fallback error:", recipientErr);
      }

      recipient = recipientByPhone;
    }

    if (!recipient) {
      console.error("[checkout-guest] FINAL: Recipient not found.", {
        reference: cleanReference || null,
        merchant_id: resolvedMerchantId,
        recipient_phone: cleanRecipient || null,
      });
      return jsonRes({ error: "Recipient not found. The merchant may be inactive or the payment link is invalid." }, 400);
    }

    if (payer.user_id === recipient.user_id) {
      return jsonRes({ error: "Cannot pay yourself" }, 400);
    }

    if (payer.balance < amount) {
      return jsonRes({ error: "Insufficient balance" }, 400);
    }

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

    const { data: merch } = await supabaseAdmin
      .from("merchants")
      .select("business_name")
      .eq("user_id", recipient.user_id)
      .eq("status", "active")
      .maybeSingle();

    const recipientName = merch?.business_name || recipient.name || recipient.phone;
    const payerName = payer.name || cleanPhone;

    await supabaseAdmin.from("transactions").insert({
      user_id: payer.user_id,
      type: "payment",
      amount,
      fee: 0,
      balance_after: payerNewBalance,
      recipient_phone: recipient.phone,
      recipient_name: recipientName,
      description: description || `Payment to ${recipientName}`,
      reference: cleanReference || null,
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
      reference: cleanReference || null,
      status: "completed",
    });

    if (cleanReference) {
      const { data: linkRow } = await supabaseAdmin
        .from("payment_links")
        .select("id, used_count")
        .eq("short_code", cleanReference)
        .eq("is_active", true)
        .maybeSingle();

      if (linkRow) {
        await supabaseAdmin
          .from("payment_links")
          .update({ used_count: (linkRow.used_count || 0) + 1 })
          .eq("id", linkRow.id);
      }
    }

    console.log("[checkout-guest] Payment completed:", {
      payer: cleanPhone,
      recipient: recipient.phone,
      amount,
      reference: cleanReference || null,
    });

    return jsonRes({ success: true, message: "Payment completed" });
  } catch (err) {
    console.error("checkout-guest error:", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});

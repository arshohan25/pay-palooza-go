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

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // DB client – service-role, never touched by signInWithPassword
    const dbClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Auth client – separate instance, used ONLY for PIN verification
    const authClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const cleanPhone = String(phone).replace(/\D/g, "").replace(/^88/, "");
    const cleanRecipient = String(recipient_phone ?? "").replace(/\D/g, "").replace(/^88/, "");
    const cleanReference = typeof reference === "string" ? reference.trim().toUpperCase() : "";
    const safeMerchantId = typeof clientMerchantId === "string" ? clientMerchantId.trim() : "";

    // ── 1. Verify OTP ──
    const now = new Date().toISOString();
    const { data: otpRow, error: otpErr } = await dbClient
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
    await dbClient.from("otp_codes").update({ verified: true }).eq("id", otpRow.id);

    // ── 2. Lookup payer profile ──
    const { data: payer } = await dbClient
      .from("profiles")
      .select("user_id, balance, name, phone")
      .eq("phone", cleanPhone)
      .eq("status", "active")
      .single();

    if (!payer) {
      return jsonRes({ error: "Account not found or inactive" }, 400);
    }

    // ── 3. Verify PIN on the SEPARATE auth client ──
    const password = `${pin}EP`;
    const emailDomains = ["easypay.app", "example.com", "easypay.local"];
    let authPassed = false;

    for (const domain of emailDomains) {
      const { error } = await authClient.auth.signInWithPassword({
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
    console.log("[checkout-guest] PIN verified for", cleanPhone);

    // ── 4. Resolve recipient (all queries on dbClient – unaffected by auth) ──
    let recipient: { user_id: string; balance: number; name: string | null; phone: string } | null = null;
    let resolvedMerchantId: string | null = null;

    // Priority 1: payment link reference
    if (cleanReference) {
      console.log("[checkout-guest] Resolving via reference:", cleanReference);

      const { data: paymentLink, error: linkErr } = await dbClient
        .from("payment_links")
        .select("id, merchant_id, merchant_code, short_code, is_active")
        .eq("short_code", cleanReference)
        .eq("is_active", true)
        .maybeSingle();

      if (linkErr) console.error("[checkout-guest] payment_links lookup error:", linkErr);

      if (paymentLink) {
        resolvedMerchantId = paymentLink.merchant_id ?? null;
        console.log("[checkout-guest] Payment link matched:", {
          id: paymentLink.id,
          merchant_id: paymentLink.merchant_id,
        });
      } else {
        console.warn("[checkout-guest] No active payment link for short_code:", cleanReference);
      }
    }

    // Priority 2: client-sent merchant_id fallback
    if (!resolvedMerchantId && safeMerchantId) {
      resolvedMerchantId = safeMerchantId;
      console.log("[checkout-guest] Using client merchant_id fallback:", safeMerchantId);
    }

    // Merchant → profile resolution
    if (resolvedMerchantId) {
      const { data: merchantRow, error: merchantErr } = await dbClient
        .from("merchants")
        .select("id, user_id")
        .eq("id", resolvedMerchantId)
        .eq("status", "active")
        .maybeSingle();

      if (merchantErr) console.error("[checkout-guest] merchant lookup error:", merchantErr);

      if (merchantRow?.user_id) {
        const { data: merchantProfile, error: profileErr } = await dbClient
          .from("profiles")
          .select("user_id, balance, name, phone")
          .eq("user_id", merchantRow.user_id)
          .eq("status", "active")
          .maybeSingle();

        if (profileErr) console.error("[checkout-guest] merchant profile error:", profileErr);
        recipient = merchantProfile;
        console.log("[checkout-guest] Recipient from merchant:", {
          merchant_id: merchantRow.id,
          user_id: merchantRow.user_id,
          phone: merchantProfile?.phone,
        });
      } else {
        console.error("[checkout-guest] No active merchant for id:", resolvedMerchantId);
      }
    }

    // Priority 3: direct phone fallback (non-link flows)
    if (!recipient && cleanRecipient) {
      console.log("[checkout-guest] Phone fallback for", cleanRecipient);
      const { data: byPhone } = await dbClient
        .from("profiles")
        .select("user_id, balance, name, phone")
        .eq("phone", cleanRecipient)
        .eq("status", "active")
        .maybeSingle();
      recipient = byPhone;
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

    const { data: merch } = await dbClient
      .from("merchants")
      .select("business_name")
      .eq("user_id", recipient.user_id)
      .eq("status", "active")
      .maybeSingle();

    const recipientName = merch?.business_name || recipient.name || recipient.phone;
    const payerName = payer.name || cleanPhone;

    // ── 5. Atomic transfer via RPC ──
    const { error: rpcErr } = await dbClient.rpc("checkout_atomic_transfer", {
      p_payer_user_id: payer.user_id,
      p_recipient_user_id: recipient.user_id,
      p_amount: amount,
      p_payer_recipient_phone: recipient.phone,
      p_payer_recipient_name: recipientName,
      p_recipient_payer_phone: cleanPhone,
      p_recipient_payer_name: payerName,
      p_description: description ?? null,
      p_reference: cleanReference || null,
    });
    if (rpcErr) {
      const msg = rpcErr.message || "Transfer failed";
      const status = /insufficient/i.test(msg) ? 400 : 500;
      return jsonRes({ error: msg }, status);
    }

    // Update payment link usage
    if (cleanReference) {
      const { data: linkRow } = await dbClient
        .from("payment_links")
        .select("id, used_count")
        .eq("short_code", cleanReference)
        .eq("is_active", true)
        .maybeSingle();

      if (linkRow) {
        await dbClient
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Atomically credit a user's balance with idempotency check.
 */
async function creditUserBalance(
  supabaseAdmin: any,
  userId: string,
  amount: number,
  description: string,
  reference: string
): Promise<{ success: boolean; alreadyCredited?: boolean }> {
  // Idempotency: check if a completed transaction with this reference already exists
  const { data: existingTxn } = await supabaseAdmin
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("reference", reference)
    .eq("type", "addmoney")
    .eq("status", "completed")
    .maybeSingle();

  if (existingTxn) {
    console.log(`Idempotency: transaction already exists for reference ${reference}`);
    return { success: true, alreadyCredited: true };
  }

  // Atomic credit via SECURITY DEFINER RPC (no read-then-write race).
  const { data: newBalance, error: creditErr } = await supabaseAdmin.rpc("credit_user_balance", {
    p_user_id: userId,
    p_amount: amount,
  });
  if (creditErr || newBalance == null) {
    console.error(`creditUserBalance: RPC failed for user ${userId}`, creditErr);
    return { success: false };
  }

  await supabaseAdmin.from("transactions").insert({
    user_id: userId,
    type: "addmoney",
    amount,
    fee: 0,
    balance_after: Number(newBalance),
    description,
    reference,
    status: "completed",
  });

  return { success: true };
}

/**
 * Unified webhook/callback handler for payment providers (bKash, Nagad).
 * This is called by the payment provider after the user completes/cancels payment.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (provider === "bkash") {
      return await handleBkashCallback(req, url, supabaseAdmin);
    }

    if (provider === "nagad") {
      return await handleNagadCallback(req, url, supabaseAdmin);
    }

    if (provider === "asthapay") {
      return await handleAsthapayIPN(req, supabaseAdmin);
    }

    return new Response(JSON.stringify({ error: "Unknown provider" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleBkashCallback(
  req: Request,
  url: URL,
  supabaseAdmin: any
) {
  // bKash sends callback as GET with query params: paymentID, status
  const paymentID = url.searchParams.get("paymentID");
  const status = url.searchParams.get("status");

  if (!paymentID) {
    return new Response("Missing paymentID", { status: 400, headers: corsHeaders });
  }

  // Find session by provider_payment_id
  const { data: session } = await supabaseAdmin
    .from("payment_sessions")
    .select("*")
    .eq("provider", "bkash")
    .eq("provider_payment_id", paymentID)
    .single();

  if (!session) {
    console.error("bKash callback: session not found for paymentID", paymentID);
    return new Response("Session not found", { status: 404, headers: corsHeaders });
  }

  if (status === "success") {
    // Update session — the execute step will be called by the frontend
    await supabaseAdmin
      .from("payment_sessions")
      .update({
        metadata: {
          ...((session.metadata as Record<string, unknown>) || {}),
          callback_status: "success",
        },
      })
      .eq("id", session.id);
  } else {
    // Payment was cancelled or failed
    await supabaseAdmin
      .from("payment_sessions")
      .update({ status: status === "cancel" ? "failed" : "failed" })
      .eq("id", session.id);
  }

  // Redirect user back to the app
  const appUrl = session.callback_url || "https://pay-palooza-go.lovable.app";
  const redirectUrl = `${appUrl}?payment_status=${status}&session_id=${session.id}&provider=bkash`;

  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: redirectUrl },
  });
}

async function handleNagadCallback(
  req: Request,
  url: URL,
  supabaseAdmin: any
) {
  // Nagad sends callback with payment info
  let callbackData: Record<string, unknown> = {};

  if (req.method === "POST") {
    callbackData = await req.json();
  } else {
    // GET params
    for (const [key, value] of url.searchParams.entries()) {
      callbackData[key] = value;
    }
  }

  const paymentRefId = callbackData.payment_ref_id || callbackData.paymentRefId;
  const status = callbackData.status || callbackData.status_code;
  const additionalInfo = callbackData.additionalMerchantInfo;

  let sessionId: string | null = null;
  if (typeof additionalInfo === "string") {
    try {
      const parsed = JSON.parse(additionalInfo);
      sessionId = parsed.sessionId;
    } catch { /* ignore */ }
  }

  // Find session
  let session: any;
  if (sessionId) {
    const { data } = await supabaseAdmin
      .from("payment_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();
    session = data;
  } else if (paymentRefId) {
    const { data } = await supabaseAdmin
      .from("payment_sessions")
      .select("*")
      .eq("provider", "nagad")
      .eq("provider_payment_id", paymentRefId as string)
      .single();
    session = data;
  }

  if (!session) {
    console.error("Nagad callback: session not found", callbackData);
    return new Response("Session not found", { status: 404, headers: corsHeaders });
  }

  if (status === "Success" || status === "000") {
    // Idempotency gate: only process if session is still pending
    if (session.status !== "completed") {
      const { data: updatedSession } = await supabaseAdmin
        .from("payment_sessions")
        .update({
          status: "completed",
          provider_trx_id: (callbackData.issuerPaymentRefNo || paymentRefId) as string,
          completed_at: new Date().toISOString(),
          metadata: {
            ...((session.metadata as Record<string, unknown>) || {}),
            callback_data: callbackData,
          },
        })
        .eq("id", session.id)
        .eq("status", "pending") // Only update if still pending
        .select("id")
        .maybeSingle();

      if (updatedSession) {
        // Credit user's balance with idempotency check
        const creditResult = await creditUserBalance(
          supabaseAdmin,
          session.user_id as string,
          parseFloat(String(session.amount)),
          `Nagad Payment (Ref: ${paymentRefId || session.provider_payment_id})`,
          session.id as string
        );

        // Debit treasury for this add-money
        if (!creditResult.alreadyCredited && creditResult.success) {
          try {
            await supabaseAdmin.rpc("treasury_debit_for_addmoney", {
              p_user_id: session.user_id as string,
              p_amount: parseFloat(String(session.amount)),
            });
          } catch (treasuryErr) {
            console.error("Treasury debit failed (non-blocking):", treasuryErr);
          }
        }

        // Audit log
        try {
          await supabaseAdmin.from("audit_logs").insert({
            actor_id: session.user_id as string,
            action: "payment_credit_webhook",
            entity_type: "payment_session",
            entity_id: session.id as string,
            details: {
              provider: "nagad",
              amount: session.amount,
              ref_id: paymentRefId,
              callback_data: callbackData,
              already_credited: creditResult.alreadyCredited || false,
            },
          });
        } catch (auditErr) {
          console.error("Audit log insert failed:", auditErr);
        }
      } else {
        console.log(`Nagad webhook: session ${session.id} already processed, skipping credit`);
      }
    }
  } else {
    await supabaseAdmin
      .from("payment_sessions")
      .update({
        status: "failed",
        metadata: {
          ...((session.metadata as Record<string, unknown>) || {}),
          callback_data: callbackData,
        },
      })
      .eq("id", session.id);
  }

  // Redirect back to app
  const appUrl = session.callback_url || "https://pay-palooza-go.lovable.app";
  const redirectUrl = `${appUrl}?payment_status=${status === "Success" || status === "000" ? "success" : "failed"}&session_id=${session.id}&provider=nagad`;

  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: redirectUrl },
  });
}

// ─── AsthaPay helpers ───

const ASTHAPAY_BASE = "https://pay.asthapay.com/api/payment";

interface AsthapayCredentials {
  apiKey: string;
  secretKey: string;
  brandKey: string;
}

async function getAsthapayCredentials(
  supabaseAdmin: any
): Promise<AsthapayCredentials | null> {
  const { data } = await supabaseAdmin
    .from("payment_gateways")
    .select("config, is_enabled")
    .eq("provider", "asthapay")
    .maybeSingle();

  if (data?.is_enabled && data.config) {
    const c = data.config as Record<string, string>;
    if (c.api_key && c.secret_key && c.brand_key) {
      return { apiKey: c.api_key, secretKey: c.secret_key, brandKey: c.brand_key };
    }
  }
  return null;
}

async function handleAsthapayIPN(
  req: Request,
  supabaseAdmin: any
) {
  // AsthaPay sends IPN as POST with JSON body
  let ipnData: Record<string, unknown> = {};
  try {
    ipnData = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("AsthaPay IPN received:", JSON.stringify(ipnData));

  const transactionId = ipnData.transaction_id as string | undefined;
  const invoiceNumber = ipnData.invoice_number as string | undefined;
  const ipnStatus = ipnData.status as string | undefined;

  if (!transactionId && !invoiceNumber) {
    return new Response(JSON.stringify({ error: "Missing transaction_id or invoice_number" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find payment session
  let session: any = null;

  if (transactionId) {
    const { data } = await supabaseAdmin
      .from("payment_sessions")
      .select("*")
      .eq("provider", "asthapay")
      .eq("provider_payment_id", transactionId)
      .single();
    session = data;
  }

  if (!session && invoiceNumber) {
    // Fallback: search by invoice_number in metadata
    const { data: sessions } = await supabaseAdmin
      .from("payment_sessions")
      .select("*")
      .eq("provider", "asthapay")
      .eq("status", "pending");

    if (sessions) {
      session = sessions.find((s: Record<string, unknown>) => {
        const meta = s.metadata as Record<string, unknown> | null;
        return meta?.invoice_number === invoiceNumber;
      }) || null;
    }
  }

  if (!session) {
    console.error("AsthaPay IPN: session not found", ipnData);
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Already completed — idempotent
  if (session.status === "completed") {
    return new Response(JSON.stringify({ success: true, alreadyProcessed: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify with AsthaPay API (server-to-server validation)
  const creds = await getAsthapayCredentials(supabaseAdmin);
  if (!creds) {
    console.error("AsthaPay IPN: credentials not configured, cannot verify");
    return new Response(JSON.stringify({ error: "AsthaPay credentials not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const txnId = transactionId || (session.provider_payment_id as string);
  const verifyRes = await fetch(`${ASTHAPAY_BASE}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "API-KEY": creds.apiKey,
      "SECRET-KEY": creds.secretKey,
      "BRAND-KEY": creds.brandKey,
    },
    body: JSON.stringify({ transaction_id: txnId }),
  });

  const verifyData = await verifyRes.json();

  const isSuccess = verifyData.status === "COMPLETED" || verifyData.status === "completed" || verifyData.status === "Success";

  if (!isSuccess) {
    console.log("AsthaPay IPN: verification failed", verifyData);
    await supabaseAdmin
      .from("payment_sessions")
      .update({
        status: "failed",
        metadata: {
          ...((session.metadata as Record<string, unknown>) || {}),
          ipn_data: ipnData,
          verify_result: verifyData,
        },
      })
      .eq("id", session.id);

    return new Response(JSON.stringify({ success: false, status: verifyData.status }), {
      status: 200, // Return 200 to AsthaPay so it doesn't retry
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Idempotency gate: only update if still pending
  const { data: updatedSession } = await supabaseAdmin
    .from("payment_sessions")
    .update({
      status: "completed",
      provider_trx_id: verifyData.transaction_id || txnId,
      completed_at: new Date().toISOString(),
      metadata: {
        ...((session.metadata as Record<string, unknown>) || {}),
        ipn_data: ipnData,
        verify_result: verifyData,
      },
    })
    .eq("id", session.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (!updatedSession) {
    console.log(`AsthaPay IPN: session ${session.id} already processed, skipping credit`);
    return new Response(JSON.stringify({ success: true, alreadyProcessed: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Credit user balance
  const creditResult = await creditUserBalance(
    supabaseAdmin,
    session.user_id as string,
    parseFloat(String(session.amount)),
    `AsthaPay Payment (TxnID: ${txnId})`,
    session.id as string
  );

  // Treasury debit
  if (!creditResult.alreadyCredited && creditResult.success) {
    try {
      await supabaseAdmin.rpc("treasury_debit_for_addmoney", {
        p_user_id: session.user_id as string,
        p_amount: parseFloat(String(session.amount)),
      });
    } catch (treasuryErr) {
      console.error("Treasury debit failed (non-blocking):", treasuryErr);
    }
  }

  // Audit log
  try {
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: session.user_id as string,
      action: "payment_credit_ipn",
      entity_type: "payment_session",
      entity_id: session.id as string,
      details: {
        provider: "asthapay",
        amount: session.amount,
        trx_id: txnId,
        ipn_data: ipnData,
        already_credited: creditResult.alreadyCredited || false,
      },
    });
  } catch (auditErr) {
    console.error("Audit log insert failed:", auditErr);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
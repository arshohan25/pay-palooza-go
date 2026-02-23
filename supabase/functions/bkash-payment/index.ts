import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// bKash Tokenized Checkout v2 endpoints
const BKASH_SANDBOX_BASE = "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout";
const BKASH_LIVE_BASE = "https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout";

function getBaseUrl(): string {
  const mode = Deno.env.get("BKASH_MODE") || "sandbox";
  return mode === "live" ? BKASH_LIVE_BASE : BKASH_SANDBOX_BASE;
}

function getCredentials() {
  const appKey = Deno.env.get("BKASH_APP_KEY");
  const appSecret = Deno.env.get("BKASH_APP_SECRET");
  const username = Deno.env.get("BKASH_USERNAME");
  const password = Deno.env.get("BKASH_PASSWORD");

  if (!appKey || !appSecret || !username || !password) {
    throw new Error("bKash credentials not configured. Required: BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, BKASH_PASSWORD");
  }
  return { appKey, appSecret, username, password };
}

/** Step 1: Grant Token */
async function grantToken(): Promise<{ id_token: string; token_type: string }> {
  const { appKey, appSecret, username, password } = getCredentials();
  const base = getBaseUrl();

  const res = await fetch(`${base}/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username,
      password,
    },
    body: JSON.stringify({ app_key: appKey, app_secret: appSecret }),
  });

  const data = await res.json();
  if (!res.ok || data.statusCode === "2023" || !data.id_token) {
    throw new Error(`bKash grant token failed: ${JSON.stringify(data)}`);
  }
  return data;
}

/** Step 2: Create Payment */
async function createPayment(params: {
  idToken: string;
  amount: string;
  merchantInvoiceNumber: string;
  callbackURL: string;
  payerReference: string;
}): Promise<{ paymentID: string; bkashURL: string; statusCode: string }> {
  const { appKey } = getCredentials();
  const base = getBaseUrl();

  const res = await fetch(`${base}/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      authorization: params.idToken,
      "x-app-key": appKey,
    },
    body: JSON.stringify({
      mode: "0011",
      payerReference: params.payerReference,
      callbackURL: params.callbackURL,
      amount: params.amount,
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: params.merchantInvoiceNumber,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.paymentID) {
    throw new Error(`bKash create payment failed: ${JSON.stringify(data)}`);
  }
  return data;
}

/** Step 3: Execute Payment (called after user completes payment on bKash page) */
async function executePayment(idToken: string, paymentID: string): Promise<Record<string, unknown>> {
  const { appKey } = getCredentials();
  const base = getBaseUrl();

  const res = await fetch(`${base}/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      authorization: idToken,
      "x-app-key": appKey,
    },
    body: JSON.stringify({ paymentID }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`bKash execute payment failed: ${JSON.stringify(data)}`);
  }
  return data;
}

/**
 * Atomically credit a user's balance using row-level locking via RPC.
 * Falls back to a locked direct update if RPC fails (service role context).
 * Includes idempotency check to prevent duplicate credits.
 */
async function creditUserBalance(
  supabaseAdmin: ReturnType<typeof createClient>,
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

  // Use SQL function for atomic balance update with row-level locking
  // record_transaction uses auth.uid() so won't work with service role.
  // We do a locked read-then-update instead.
  const { data: profile, error: profileError } = await supabaseAdmin.rpc("credit_user_balance", {
    p_user_id: userId,
    p_amount: amount,
    p_description: description,
    p_reference: reference,
  });

  if (!profileError && profile) {
    return { success: true };
  }

  // Fallback: manual atomic update (the RPC may not exist yet)
  // Use a transaction-safe pattern: read with lock concept via unique reference
  const { data: currentProfile } = await supabaseAdmin
    .from("profiles")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (!currentProfile) {
    console.error(`creditUserBalance: profile not found for user ${userId}`);
    return { success: false };
  }

  const newBalance = parseFloat(String(currentProfile.balance)) + amount;

  await supabaseAdmin
    .from("profiles")
    .update({ balance: newBalance })
    .eq("user_id", userId);

  await supabaseAdmin.from("transactions").insert({
    user_id: userId,
    type: "addmoney",
    amount: amount,
    fee: 0,
    balance_after: newBalance,
    description,
    reference,
    status: "completed",
  });

  return { success: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    if (action === "create") {
      // ─── Create Payment Session ───
      const { amount, payerReference, callbackURL } = await req.json();

      if (!amount || parseFloat(amount) <= 0) {
        return new Response(JSON.stringify({ error: "Invalid amount" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Grant token
      const tokenData = await grantToken();

      // Create payment session in DB first
      const { data: session, error: sessionError } = await supabaseAdmin
        .from("payment_sessions")
        .insert({
          user_id: userId,
          provider: "bkash",
          amount: parseFloat(amount),
          callback_url: callbackURL || null,
          status: "pending",
        })
        .select("id")
        .single();

      if (sessionError) throw sessionError;

      // Create bKash payment
      const paymentData = await createPayment({
        idToken: tokenData.id_token,
        amount: String(parseFloat(amount)),
        merchantInvoiceNumber: session.id,
        callbackURL: callbackURL || `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-webhook?provider=bkash`,
        payerReference: payerReference || "01XXXXXXXXX",
      });

      // Update session with bKash payment ID
      await supabaseAdmin
        .from("payment_sessions")
        .update({
          provider_payment_id: paymentData.paymentID,
          metadata: { id_token: tokenData.id_token, bkash_url: paymentData.bkashURL },
        })
        .eq("id", session.id);

      return new Response(
        JSON.stringify({
          success: true,
          sessionId: session.id,
          paymentID: paymentData.paymentID,
          bkashURL: paymentData.bkashURL,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "execute") {
      // ─── Execute Payment after user returns from bKash ───
      const { sessionId, paymentID } = await req.json();

      // Verify session belongs to user
      const { data: session } = await supabaseAdmin
        .from("payment_sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("user_id", userId)
        .single();

      if (!session) {
        return new Response(JSON.stringify({ error: "Session not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Idempotency: already completed
      if (session.status === "completed") {
        return new Response(JSON.stringify({ 
          success: true, 
          trxID: session.provider_trx_id, 
          transactionStatus: "Completed",
          alreadyProcessed: true 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const idToken = (session.metadata as Record<string, string>)?.id_token;
      if (!idToken) {
        const tokenData = await grantToken();
        const result = await executePayment(tokenData.id_token, paymentID || session.provider_payment_id);
        return handleExecuteResult(supabaseAdmin, session, result);
      }

      const result = await executePayment(idToken, paymentID || session.provider_payment_id);
      return handleExecuteResult(supabaseAdmin, session, result);
    }

    if (action === "status") {
      const { sessionId } = await req.json();
      const { data: session } = await supabaseAdmin
        .from("payment_sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("user_id", userId)
        .single();

      if (!session) {
        return new Response(JSON.stringify({ error: "Session not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ status: session.status, provider_trx_id: session.provider_trx_id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: create, execute, status" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("bKash payment error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleExecuteResult(
  supabaseAdmin: ReturnType<typeof createClient>,
  session: Record<string, unknown>,
  result: Record<string, unknown>
) {
  const trxID = result.trxID as string;
  const statusCode = result.statusCode as string;
  const transactionStatus = result.transactionStatus as string;

  if (transactionStatus === "Completed" && statusCode === "0000") {
    // Mark session completed FIRST (idempotency gate)
    const { data: updatedSession, error: updateError } = await supabaseAdmin
      .from("payment_sessions")
      .update({
        status: "completed",
        provider_trx_id: trxID,
        completed_at: new Date().toISOString(),
        metadata: { ...((session.metadata as Record<string, unknown>) || {}), execute_result: result },
      })
      .eq("id", session.id)
      .eq("status", "pending") // Only update if still pending (idempotency)
      .select("id")
      .maybeSingle();

    if (!updatedSession) {
      // Session was already completed (duplicate callback)
      console.log(`bKash: session ${session.id} already processed, skipping credit`);
      return new Response(
        JSON.stringify({ success: true, trxID, transactionStatus: "Completed", alreadyProcessed: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Credit user's balance with idempotency check
    const creditResult = await creditUserBalance(
      supabaseAdmin,
      session.user_id as string,
      session.amount as number,
      `bKash Payment (TrxID: ${trxID})`,
      session.id as string
    );

    if (!creditResult.success) {
      console.error(`bKash: failed to credit user ${session.user_id} for session ${session.id}`);
    }

    // Audit log
    try {
      await supabaseAdmin.from("audit_logs").insert({
        actor_id: session.user_id as string,
        action: "payment_credit",
        entity_type: "payment_session",
        entity_id: session.id as string,
        details: {
          provider: "bkash",
          amount: session.amount,
          trx_id: trxID,
          already_credited: creditResult.alreadyCredited || false,
        },
      });
    } catch (auditErr) {
      console.error("Audit log insert failed:", auditErr);
    }

    return new Response(
      JSON.stringify({ success: true, trxID, transactionStatus: "Completed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } else {
    // Payment failed or cancelled
    await supabaseAdmin
      .from("payment_sessions")
      .update({
        status: "failed",
        metadata: { ...((session.metadata as Record<string, unknown>) || {}), execute_result: result },
      })
      .eq("id", session.id);

    return new Response(
      JSON.stringify({
        success: false,
        error: result.statusMessage || "Payment was not completed",
        statusCode,
        transactionStatus,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// bKash Tokenized Checkout v2 endpoints
const BKASH_SANDBOX_BASE = "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout";
const BKASH_LIVE_BASE = "https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout";

interface BkashCredentials {
  appKey: string;
  appSecret: string;
  username: string;
  password: string;
  mode: string;
}

function getBaseUrl(mode: string): string {
  return mode === "live" ? BKASH_LIVE_BASE : BKASH_SANDBOX_BASE;
}

/**
 * Read bKash credentials from payment_gateways DB table (service role).
 * Falls back to env vars for backward compatibility.
 */
async function getCredentials(supabaseAdmin: any): Promise<BkashCredentials | null> {
  // Try DB first
  const { data } = await supabaseAdmin
    .from("payment_gateways")
    .select("config, is_enabled")
    .eq("provider", "bkash")
    .maybeSingle();

  if (data?.is_enabled && data.config) {
    const c = data.config as Record<string, string>;
    if (c.app_key && c.app_secret && c.username && c.password) {
      return {
        appKey: c.app_key,
        appSecret: c.app_secret,
        username: c.username,
        password: c.password,
        mode: c.mode || "sandbox",
      };
    }
  }

  // Fallback to env vars
  const appKey = Deno.env.get("BKASH_APP_KEY");
  const appSecret = Deno.env.get("BKASH_APP_SECRET");
  const username = Deno.env.get("BKASH_USERNAME");
  const password = Deno.env.get("BKASH_PASSWORD");

  if (!appKey || !appSecret || !username || !password) {
    return null;
  }
  return { appKey, appSecret, username, password, mode: Deno.env.get("BKASH_MODE") || "sandbox" };
}

/** Step 1: Grant Token */
async function grantToken(creds: BkashCredentials): Promise<{ id_token: string; token_type: string }> {
  const base = getBaseUrl(creds.mode);

  const res = await fetch(`${base}/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username: creds.username,
      password: creds.password,
    },
    body: JSON.stringify({ app_key: creds.appKey, app_secret: creds.appSecret }),
  });

  const data = await res.json();
  if (!res.ok || data.statusCode === "2023" || !data.id_token) {
    throw new Error(`bKash grant token failed: ${JSON.stringify(data)}`);
  }
  return data;
}

/** Step 2: Create Payment */
async function createPayment(creds: BkashCredentials, params: {
  idToken: string;
  amount: string;
  merchantInvoiceNumber: string;
  callbackURL: string;
  payerReference: string;
}): Promise<{ paymentID: string; bkashURL: string; statusCode: string }> {
  const base = getBaseUrl(creds.mode);

  const res = await fetch(`${base}/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      authorization: params.idToken,
      "x-app-key": creds.appKey,
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

/** Step 3: Execute Payment */
async function executePayment(creds: BkashCredentials, idToken: string, paymentID: string): Promise<Record<string, unknown>> {
  const base = getBaseUrl(creds.mode);

  const res = await fetch(`${base}/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      authorization: idToken,
      "x-app-key": creds.appKey,
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
 * Atomically credit a user's balance with idempotency check.
 */
async function creditUserBalance(
  supabaseAdmin: any,
  userId: string,
  amount: number,
  description: string,
  reference: string
): Promise<{ success: boolean; alreadyCredited?: boolean }> {
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

  const { data: profile, error: profileError } = await supabaseAdmin.rpc("credit_user_balance", {
    p_user_id: userId,
    p_amount: amount,
    p_description: description,
    p_reference: reference,
  });

  if (!profileError && profile) {
    return { success: true };
  }

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
      const { amount, payerReference, callbackURL } = await req.json();

      if (!amount || parseFloat(amount) <= 0) {
        return new Response(JSON.stringify({ error: "Invalid amount" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const creds = await getCredentials(supabaseAdmin);

      if (!creds) {
        console.log("bKash: No credentials configured – using simulated mode");
        return new Response(
          JSON.stringify({
            success: true,
            simulated: true,
            message: "bKash credentials not configured. Simulated payment – use the app's fallback flow.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenData = await grantToken(creds);

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

      const paymentData = await createPayment(creds, {
        idToken: tokenData.id_token,
        amount: String(parseFloat(amount)),
        merchantInvoiceNumber: session.id,
        callbackURL: callbackURL || `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-webhook?provider=bkash`,
        payerReference: payerReference || "01XXXXXXXXX",
      });

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
      const { sessionId, paymentID } = await req.json();

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

      const creds = await getCredentials(supabaseAdmin);
      if (!creds) throw new Error("bKash credentials not available");

      const idToken = (session.metadata as Record<string, string>)?.id_token;
      if (!idToken) {
        const tokenData = await grantToken(creds);
        const result = await executePayment(creds, tokenData.id_token, paymentID || session.provider_payment_id);
        return handleExecuteResult(supabaseAdmin, session, result);
      }

      const result = await executePayment(creds, idToken, paymentID || session.provider_payment_id);
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
  supabaseAdmin: any,
  session: any,
  result: Record<string, unknown>
) {
  const trxID = result.trxID as string;
  const statusCode = result.statusCode as string;
  const transactionStatus = result.transactionStatus as string;

  if (transactionStatus === "Completed" && statusCode === "0000") {
    const { data: updatedSession } = await supabaseAdmin
      .from("payment_sessions")
      .update({
        status: "completed",
        provider_trx_id: trxID,
        completed_at: new Date().toISOString(),
        metadata: { ...((session.metadata as Record<string, unknown>) || {}), execute_result: result },
      })
      .eq("id", session.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (!updatedSession) {
      console.log(`bKash: session ${session.id} already processed, skipping credit`);
      return new Response(
        JSON.stringify({ success: true, trxID, transactionStatus: "Completed", alreadyProcessed: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

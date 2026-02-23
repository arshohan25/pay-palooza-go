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

/** Query Payment status */
async function queryPayment(idToken: string, paymentID: string): Promise<Record<string, unknown>> {
  const { appKey } = getCredentials();
  const base = getBaseUrl();

  const res = await fetch(`${base}/payment/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      authorization: idToken,
      "x-app-key": appKey,
    },
    body: JSON.stringify({ paymentID }),
  });

  return await res.json();
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

      if (session.status === "completed") {
        return new Response(JSON.stringify({ error: "Payment already processed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const idToken = (session.metadata as Record<string, string>)?.id_token;
      if (!idToken) {
        // Re-grant token if expired
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
    // Mark session completed
    await supabaseAdmin
      .from("payment_sessions")
      .update({
        status: "completed",
        provider_trx_id: trxID,
        completed_at: new Date().toISOString(),
        metadata: { ...((session.metadata as Record<string, unknown>) || {}), execute_result: result },
      })
      .eq("id", session.id);

    // Credit user's wallet via record_transaction RPC
    // We use service role to call the RPC on behalf of the user
    const { error: rpcError } = await supabaseAdmin.rpc("record_transaction", {
      p_type: "addmoney",
      p_amount: session.amount as number,
      p_fee: 0,
      p_description: `bKash Payment (TrxID: ${trxID})`,
      p_reference: session.id as string,
    });

    // Note: record_transaction uses auth.uid() which won't work with service role.
    // We need to credit balance directly for webhook/service-role scenarios.
    if (rpcError) {
      // Fallback: directly update balance and insert transaction
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("balance")
        .eq("user_id", session.user_id)
        .single();

      if (profile) {
        const newBalance = parseFloat(String(profile.balance)) + (session.amount as number);
        await supabaseAdmin
          .from("profiles")
          .update({ balance: newBalance })
          .eq("user_id", session.user_id);

        await supabaseAdmin.from("transactions").insert({
          user_id: session.user_id as string,
          type: "addmoney",
          amount: session.amount as number,
          fee: 0,
          balance_after: newBalance,
          description: `bKash Payment (TrxID: ${trxID})`,
          reference: session.id as string,
          status: "completed",
        });
      }
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

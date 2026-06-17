import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASTHAPAY_BASE = "https://pay.asthapay.com/api/payment";
const BD_PHONE_REGEX = /^01[3-9]\d{8}$/;

interface AsthapayCredentials {
  apiKey: string;
  secretKey: string;
  brandKey: string;
  receivingNumber: string | null;
}

async function getCredentials(
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
      // Validate receiving_number if present
      const recvNum = c.receiving_number?.trim() || null;
      if (recvNum && !BD_PHONE_REGEX.test(recvNum)) {
        console.error(`AsthaPay: invalid receiving_number in config: ${recvNum}`);
        return null;
      }
      return {
        apiKey: c.api_key,
        secretKey: c.secret_key,
        brandKey: c.brand_key,
        receivingNumber: recvNum,
      };
    }
  }
  return null;
}

/**
 * Idempotent balance credit via direct DB operations (same pattern as bkash-payment).
 */
async function creditUserBalance(
  supabaseAdmin: any,
  userId: string,
  amount: number,
  description: string,
  reference: string
): Promise<{ success: boolean; alreadyCredited?: boolean }> {
  // Idempotency check
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

    // ────── CREATE ──────
    if (action === "create") {
      const { amount, callbackURL } = await req.json();
      const parsedAmount = parseFloat(amount);

      if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
        return new Response(JSON.stringify({ error: "Invalid amount" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const creds = await getCredentials(supabaseAdmin);

      if (!creds) {
        console.log("AsthaPay: No credentials configured – returning simulated");
        return new Response(
          JSON.stringify({
            success: true,
            simulated: true,
            message: "AsthaPay credentials not configured.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch user profile for required cus_name and cus_email
      const { data: userProfile } = await supabaseAdmin
        .from("profiles")
        .select("name, email, phone")
        .eq("user_id", userId)
        .single();

      const cusName = userProfile?.name || userProfile?.phone || "EasyPay User";
      const cusEmail = userProfile?.email || `${userProfile?.phone || userId}@easypay.app`;

      // Create payment session in DB
      const { data: session, error: sessionError } = await supabaseAdmin
        .from("payment_sessions")
        .insert({
          user_id: userId,
          provider: "asthapay",
          amount: parsedAmount,
          callback_url: callbackURL || null,
          status: "pending",
          metadata: { cus_name: cusName, cus_email: cusEmail },
        })
        .select("id")
        .single();

      if (sessionError) throw sessionError;

      const successUrl = `${callbackURL || Deno.env.get("SUPABASE_URL")}?asthapay=1&sessionId=${session.id}&status=success`;
      const cancelUrl = `${callbackURL || Deno.env.get("SUPABASE_URL")}?asthapay=1&sessionId=${session.id}&status=cancel`;

      // Call AsthaPay create API (per official docs: cus_name, cus_email, amount, success_url, cancel_url, meta_data)
      const createRes = await fetch(`${ASTHAPAY_BASE}/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "API-KEY": creds.apiKey,
          "SECRET-KEY": creds.secretKey,
          "BRAND-KEY": creds.brandKey,
        },
        body: JSON.stringify({
          cus_name: cusName,
          cus_email: cusEmail,
          amount: String(parsedAmount),
          success_url: successUrl,
          cancel_url: cancelUrl,
          ipn_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-webhook?provider=asthapay`,
          meta_data: {
            sessionId: session.id,
            userId: userId,
          },
        }),
      });

      const createData = await createRes.json();

      if (!createRes.ok || !createData.payment_url) {
        console.error("AsthaPay create failed:", createData);
        // Update session to failed
        await supabaseAdmin
          .from("payment_sessions")
          .update({ status: "failed", metadata: { error: createData } })
          .eq("id", session.id);

        throw new Error(createData.message || "AsthaPay payment creation failed");
      }

      // Update session with provider data
      await supabaseAdmin
        .from("payment_sessions")
        .update({
          provider_payment_id: createData.transaction_id || null,
          metadata: {
            cus_name: cusName,
            cus_email: cusEmail,
            asthapay_response: createData,
          },
        })
        .eq("id", session.id);

      return new Response(
        JSON.stringify({
          success: true,
          sessionId: session.id,
          payment_url: createData.payment_url,
          transaction_id: createData.transaction_id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ────── VERIFY ──────
    if (action === "verify") {
      const { sessionId, transaction_id } = await req.json();

      if (!sessionId) {
        return new Response(JSON.stringify({ error: "Missing sessionId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate transaction_id format (alphanumeric, max 64 chars)
      if (transaction_id && (typeof transaction_id !== "string" || transaction_id.length > 64 || !/^[a-zA-Z0-9_\-]+$/.test(transaction_id))) {
        return new Response(JSON.stringify({ error: "Invalid transaction ID format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

      // Already completed — idempotent
      if (session.status === "completed") {
        return new Response(
          JSON.stringify({
            success: true,
            alreadyProcessed: true,
            transactionStatus: "COMPLETED",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const creds = await getCredentials(supabaseAdmin);
      if (!creds) throw new Error("AsthaPay credentials not available");

      const txnId = transaction_id || session.provider_payment_id;

      // Call AsthaPay verify API
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

      if (verifyData.status === "COMPLETED" || verifyData.status === "completed" || verifyData.status === "Success") {
        // Atomically update session to completed (idempotency gate)
        const { data: updatedSession } = await supabaseAdmin
          .from("payment_sessions")
          .update({
            status: "completed",
            provider_trx_id: verifyData.transaction_id || txnId,
            completed_at: new Date().toISOString(),
            metadata: {
              ...((session.metadata as Record<string, unknown>) || {}),
              verify_result: verifyData,
            },
          })
          .eq("id", session.id)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();

        if (!updatedSession) {
          console.log(`AsthaPay: session ${session.id} already processed`);
          return new Response(
            JSON.stringify({ success: true, alreadyProcessed: true, transactionStatus: "COMPLETED" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Credit user balance
        const creditResult = await creditUserBalance(
          supabaseAdmin,
          userId,
          session.amount as number,
          `AsthaPay Payment (TxnID: ${txnId})`,
          session.id as string
        );

        if (!creditResult.success) {
          console.error(`AsthaPay: failed to credit user ${userId} for session ${session.id}`);
        }

        // Treasury debit
        try {
          await supabaseAdmin.rpc("treasury_debit_for_addmoney", {
            p_user_id: userId,
            p_amount: session.amount as number,
          });
        } catch (treasuryErr) {
          console.error("Treasury debit failed:", treasuryErr);
        }

        // Audit log
        try {
          await supabaseAdmin.from("audit_logs").insert({
            actor_id: userId,
            action: "payment_credit",
            entity_type: "payment_session",
            entity_id: session.id as string,
            details: {
              provider: "asthapay",
              amount: session.amount,
              trx_id: txnId,
              already_credited: creditResult.alreadyCredited || false,
            },
          });
        } catch (auditErr) {
          console.error("Audit log insert failed:", auditErr);
        }

        return new Response(
          JSON.stringify({ success: true, transactionStatus: "COMPLETED", trxID: txnId }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Payment not completed
        await supabaseAdmin
          .from("payment_sessions")
          .update({
            status: "failed",
            metadata: {
              ...((session.metadata as Record<string, unknown>) || {}),
              verify_result: verifyData,
            },
          })
          .eq("id", session.id);

        return new Response(
          JSON.stringify({
            success: false,
            error: verifyData.message || "Payment was not completed",
            transactionStatus: verifyData.status,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: create, verify" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("AsthaPay payment error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

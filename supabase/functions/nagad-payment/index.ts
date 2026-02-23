import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Nagad Payment Gateway endpoints
const NAGAD_SANDBOX_BASE = "http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs";
const NAGAD_LIVE_BASE = "https://api.mynagad.com/api/dfs";

function getBaseUrl(): string {
  const mode = Deno.env.get("NAGAD_MODE") || "sandbox";
  return mode === "live" ? NAGAD_LIVE_BASE : NAGAD_SANDBOX_BASE;
}

function getCredentials() {
  const merchantId = Deno.env.get("NAGAD_MERCHANT_ID");
  const merchantPrivateKey = Deno.env.get("NAGAD_MERCHANT_PRIVATE_KEY");
  const pgPublicKey = Deno.env.get("NAGAD_PG_PUBLIC_KEY");

  if (!merchantId || !merchantPrivateKey || !pgPublicKey) {
    throw new Error("Nagad credentials not configured. Required: NAGAD_MERCHANT_ID, NAGAD_MERCHANT_PRIVATE_KEY, NAGAD_PG_PUBLIC_KEY");
  }
  return { merchantId, merchantPrivateKey, pgPublicKey };
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContent = pem.replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, "")
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function importPublicKey(pem: string): Promise<CryptoKey> {
  const pemContent = pem.replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "spki",
    binaryDer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
}

async function signData(data: string, privateKeyPem: string): Promise<string> {
  const key = await importPrivateKey(privateKeyPem);
  const encoded = new TextEncoder().encode(data);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoded);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function encryptData(data: string, publicKeyPem: string): Promise<string> {
  const key = await importPublicKey(publicKeyPem);
  const encoded = new TextEncoder().encode(data);
  const encrypted = await crypto.subtle.encrypt("RSA-OAEP", key, encoded);
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

function generateTimestamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}${h}${min}${s}`;
}

function generateOrderId(): string {
  return `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

const commonHeaders = {
  "Content-Type": "application/json",
  "X-KM-Api-Version": "v-0.2.0",
  "X-KM-IP-V4": "192.168.0.1",
};

/**
 * Atomically credit a user's balance with idempotency check.
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
    amount,
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
      const { amount, callbackURL } = await req.json();
      const { merchantId, merchantPrivateKey, pgPublicKey } = getCredentials();

      if (!amount || parseFloat(amount) <= 0) {
        return new Response(JSON.stringify({ error: "Invalid amount" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const orderId = generateOrderId();
      const timestamp = generateTimestamp();
      const base = getBaseUrl();

      // Step 1: Initialize payment
      const sensitiveData = JSON.stringify({
        merchantId,
        datetime: timestamp,
        orderId,
        challenge: crypto.randomUUID(),
      });

      const signature = await signData(sensitiveData, merchantPrivateKey);
      const encryptedSensitiveData = await encryptData(sensitiveData, pgPublicKey);

      const initRes = await fetch(
        `${base}/check-out/initialize/${merchantId}/${orderId}`,
        {
          method: "POST",
          headers: {
            ...commonHeaders,
            "X-KM-MC-Id": merchantId,
          },
          body: JSON.stringify({
            accountNumber: "",
            dateTime: timestamp,
            sensitiveData: encryptedSensitiveData,
            signature,
          }),
        }
      );

      const initData = await initRes.json();
      if (!initRes.ok || !initData.sensitiveData) {
        throw new Error(`Nagad initialize failed: ${JSON.stringify(initData)}`);
      }

      // Create session in DB
      const { data: session, error: sessionError } = await supabaseAdmin
        .from("payment_sessions")
        .insert({
          user_id: userId,
          provider: "nagad",
          amount: parseFloat(amount),
          status: "pending",
          callback_url: callbackURL || null,
          metadata: {
            order_id: orderId,
            init_response: initData,
          },
        })
        .select("id")
        .single();

      if (sessionError) throw sessionError;

      // Step 2: Complete checkout (payment creation)
      const paymentReferenceId = initData.paymentReferenceId;

      const completeData = JSON.stringify({
        merchantId,
        orderId,
        currencyCode: "050",
        amount: String(parseFloat(amount)),
        challenge: initData.challenge || crypto.randomUUID(),
      });

      const completeSignature = await signData(completeData, merchantPrivateKey);
      const encryptedCompleteData = await encryptData(completeData, pgPublicKey);

      const completeRes = await fetch(
        `${base}/check-out/complete/${paymentReferenceId}`,
        {
          method: "POST",
          headers: {
            ...commonHeaders,
            "X-KM-MC-Id": merchantId,
          },
          body: JSON.stringify({
            sensitiveData: encryptedCompleteData,
            signature: completeSignature,
            merchantCallbackURL: callbackURL || `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-webhook?provider=nagad`,
            additionalMerchantInfo: JSON.stringify({ sessionId: session.id }),
          }),
        }
      );

      const completeResult = await completeRes.json();

      // Update session with Nagad reference
      await supabaseAdmin
        .from("payment_sessions")
        .update({
          provider_payment_id: paymentReferenceId,
          metadata: {
            order_id: orderId,
            init_response: initData,
            complete_response: completeResult,
          },
        })
        .eq("id", session.id);

      // Nagad returns a callbackUrl for redirect
      const nagadCallbackUrl = completeResult.callBackUrl || completeResult.callbackUrl;

      return new Response(
        JSON.stringify({
          success: true,
          sessionId: session.id,
          paymentReferenceId,
          nagadURL: nagadCallbackUrl || null,
          status: completeResult.status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify") {
      // Verify a payment after callback
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

      // Idempotency: already completed
      if (session.status === "completed") {
        return new Response(
          JSON.stringify({ success: true, status: "completed", provider_trx_id: session.provider_trx_id, alreadyProcessed: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Query Nagad for verification
      const { merchantId } = getCredentials();
      const base = getBaseUrl();

      const verifyRes = await fetch(
        `${base}/verify/payment/${session.provider_payment_id}`,
        {
          method: "GET",
          headers: {
            ...commonHeaders,
            "X-KM-MC-Id": merchantId,
          },
        }
      );

      const verifyData = await verifyRes.json();

      if (verifyData.status === "Success" || verifyData.statusCode === "000") {
        // Mark session completed FIRST (idempotency gate)
        const { data: updatedSession } = await supabaseAdmin
          .from("payment_sessions")
          .update({
            status: "completed",
            provider_trx_id: verifyData.issuerPaymentRefNo || verifyData.paymentRefId,
            completed_at: new Date().toISOString(),
          })
          .eq("id", session.id)
          .eq("status", "pending") // Only update if still pending
          .select("id")
          .maybeSingle();

        if (!updatedSession) {
          // Already processed
          return new Response(
            JSON.stringify({ success: true, status: "completed", alreadyProcessed: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Credit user's balance with idempotency
        const creditResult = await creditUserBalance(
          supabaseAdmin,
          userId,
          session.amount as number,
          `Nagad Payment (Ref: ${session.provider_payment_id})`,
          session.id as string
        );

        // Audit log
        try {
          await supabaseAdmin.from("audit_logs").insert({
            actor_id: userId,
            action: "payment_credit",
            entity_type: "payment_session",
            entity_id: session.id as string,
            details: {
              provider: "nagad",
              amount: session.amount,
              ref_id: verifyData.issuerPaymentRefNo || verifyData.paymentRefId,
              already_credited: creditResult.alreadyCredited || false,
            },
          });
        } catch (auditErr) {
          console.error("Audit log insert failed:", auditErr);
        }

        return new Response(
          JSON.stringify({ success: true, status: "completed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, status: verifyData.status || "pending", details: verifyData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "status") {
      const { sessionId } = await req.json();
      const { data: session } = await supabaseAdmin
        .from("payment_sessions")
        .select("status, provider_trx_id")
        .eq("id", sessionId)
        .eq("user_id", userId)
        .single();

      if (!session) {
        return new Response(JSON.stringify({ error: "Session not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(session), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: create, verify, status" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Nagad payment error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

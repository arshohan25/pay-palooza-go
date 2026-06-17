import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NAGAD_SANDBOX_BASE = "http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs";
const NAGAD_LIVE_BASE = "https://api.mynagad.com/api/dfs";

interface NagadCredentials {
  merchantId: string;
  merchantPrivateKey: string;
  pgPublicKey: string;
  mode: string;
}

function getBaseUrl(mode: string): string {
  return mode === "live" ? NAGAD_LIVE_BASE : NAGAD_SANDBOX_BASE;
}

/**
 * Read Nagad credentials from payment_gateways DB table (service role).
 * Falls back to env vars for backward compatibility.
 */
async function getCredentials(supabaseAdmin: any): Promise<NagadCredentials> {
  // Try DB first
  const { data } = await supabaseAdmin
    .from("payment_gateways")
    .select("config, is_enabled")
    .eq("provider", "nagad")
    .maybeSingle();

  if (data?.is_enabled && data.config) {
    const c = data.config as Record<string, string>;
    if (c.merchant_id && c.merchant_private_key && c.pg_public_key) {
      return {
        merchantId: c.merchant_id,
        merchantPrivateKey: c.merchant_private_key,
        pgPublicKey: c.pg_public_key,
        mode: c.mode || "sandbox",
      };
    }
  }

  // Fallback to env vars
  const merchantId = Deno.env.get("NAGAD_MERCHANT_ID");
  const merchantPrivateKey = Deno.env.get("NAGAD_MERCHANT_PRIVATE_KEY");
  const pgPublicKey = Deno.env.get("NAGAD_PG_PUBLIC_KEY");

  if (!merchantId || !merchantPrivateKey || !pgPublicKey) {
    throw new Error("Nagad credentials not configured. Set them in Admin → Gateways or via environment variables.");
  }
  return { merchantId, merchantPrivateKey, pgPublicKey, mode: Deno.env.get("NAGAD_MODE") || "sandbox" };
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContent = pem.replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, "")
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey("pkcs8", binaryDer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

async function importPublicKey(pem: string): Promise<CryptoKey> {
  const pemContent = pem.replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey("spki", binaryDer, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
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

    if (action === "create") {
      const { amount, callbackURL } = await req.json();
      const creds = await getCredentials(supabaseAdmin);

      if (!amount || parseFloat(amount) <= 0) {
        return new Response(JSON.stringify({ error: "Invalid amount" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const orderId = generateOrderId();
      const timestamp = generateTimestamp();
      const base = getBaseUrl(creds.mode);

      const sensitiveData = JSON.stringify({
        merchantId: creds.merchantId,
        datetime: timestamp,
        orderId,
        challenge: crypto.randomUUID(),
      });

      const signature = await signData(sensitiveData, creds.merchantPrivateKey);
      const encryptedSensitiveData = await encryptData(sensitiveData, creds.pgPublicKey);

      const initRes = await fetch(
        `${base}/check-out/initialize/${creds.merchantId}/${orderId}`,
        {
          method: "POST",
          headers: { ...commonHeaders, "X-KM-MC-Id": creds.merchantId },
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

      const { data: session, error: sessionError } = await supabaseAdmin
        .from("payment_sessions")
        .insert({
          user_id: userId,
          provider: "nagad",
          amount: parseFloat(amount),
          status: "pending",
          callback_url: callbackURL || null,
          metadata: { order_id: orderId, init_response: initData },
        })
        .select("id")
        .single();

      if (sessionError) throw sessionError;

      const paymentReferenceId = initData.paymentReferenceId;

      const completeData = JSON.stringify({
        merchantId: creds.merchantId,
        orderId,
        currencyCode: "050",
        amount: String(parseFloat(amount)),
        challenge: initData.challenge || crypto.randomUUID(),
      });

      const completeSignature = await signData(completeData, creds.merchantPrivateKey);
      const encryptedCompleteData = await encryptData(completeData, creds.pgPublicKey);

      const completeRes = await fetch(
        `${base}/check-out/complete/${paymentReferenceId}`,
        {
          method: "POST",
          headers: { ...commonHeaders, "X-KM-MC-Id": creds.merchantId },
          body: JSON.stringify({
            sensitiveData: encryptedCompleteData,
            signature: completeSignature,
            merchantCallbackURL: callbackURL || `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-webhook?provider=nagad`,
            additionalMerchantInfo: JSON.stringify({ sessionId: session.id }),
          }),
        }
      );

      const completeResult = await completeRes.json();

      await supabaseAdmin
        .from("payment_sessions")
        .update({
          provider_payment_id: paymentReferenceId,
          metadata: { order_id: orderId, init_response: initData, complete_response: completeResult },
        })
        .eq("id", session.id);

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

      if (session.status === "completed") {
        return new Response(
          JSON.stringify({ success: true, status: "completed", provider_trx_id: session.provider_trx_id, alreadyProcessed: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const creds = await getCredentials(supabaseAdmin);
      const base = getBaseUrl(creds.mode);

      const verifyRes = await fetch(
        `${base}/verify/payment/${session.provider_payment_id}`,
        {
          method: "GET",
          headers: { ...commonHeaders, "X-KM-MC-Id": creds.merchantId },
        }
      );

      const verifyData = await verifyRes.json();

      if (verifyData.status === "Success" || verifyData.statusCode === "000") {
        const { data: updatedSession } = await supabaseAdmin
          .from("payment_sessions")
          .update({
            status: "completed",
            provider_trx_id: verifyData.issuerPaymentRefNo || verifyData.paymentRefId,
            completed_at: new Date().toISOString(),
          })
          .eq("id", session.id)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();

        if (!updatedSession) {
          return new Response(
            JSON.stringify({ success: true, status: "completed", alreadyProcessed: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const creditResult = await creditUserBalance(
          supabaseAdmin,
          userId,
          session.amount as number,
          `Nagad Payment (Ref: ${session.provider_payment_id})`,
          session.id as string
        );

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

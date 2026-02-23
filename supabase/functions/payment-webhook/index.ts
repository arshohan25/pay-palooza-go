import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
  supabaseAdmin: ReturnType<typeof createClient>
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
  supabaseAdmin: ReturnType<typeof createClient>
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
  let session;
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
    // Credit the user's wallet
    if (session.status !== "completed") {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("balance")
        .eq("user_id", session.user_id)
        .single();

      if (profile) {
        const newBalance = parseFloat(String(profile.balance)) + parseFloat(String(session.amount));
        await supabaseAdmin
          .from("profiles")
          .update({ balance: newBalance })
          .eq("user_id", session.user_id);

        await supabaseAdmin.from("transactions").insert({
          user_id: session.user_id,
          type: "addmoney",
          amount: session.amount,
          fee: 0,
          balance_after: newBalance,
          description: `Nagad Payment (Ref: ${paymentRefId || session.provider_payment_id})`,
          reference: session.id,
          status: "completed",
        });
      }

      await supabaseAdmin
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
        .eq("id", session.id);
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

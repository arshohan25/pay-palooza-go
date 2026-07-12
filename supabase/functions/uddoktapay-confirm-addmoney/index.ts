import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Client-invoked fallback: verifies an add-money invoice with UddoktaPay and
// credits the user's balance if the payment completed. This runs on payment
// return so a delayed/blocked IPN webhook does not leave a successful
// payment as a stuck "pending" fund_request.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const requestId: string | undefined = body?.request_id;
    let invoiceId: string | null = body?.invoice_id ?? null;
    if (!requestId) return json({ error: "request_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: fr, error: frErr } = await admin
      .from("fund_requests")
      .select("id,user_id,status,amount,transaction_id_proof,source_method,type")
      .eq("id", requestId)
      .maybeSingle();
    if (frErr || !fr) return json({ error: "Request not found" }, 404);
    if (fr.user_id !== userId) return json({ error: "Forbidden" }, 403);
    if (fr.type !== "add_money" || fr.source_method !== "uddoktapay") {
      return json({ error: "Not an UddoktaPay add-money request" }, 400);
    }

    if (fr.status === "approved") {
      return json({ ok: true, status: "COMPLETED", already: true });
    }

    if (!invoiceId) invoiceId = fr.transaction_id_proof ?? null;
    if (!invoiceId) return json({ error: "invoice_id unavailable" }, 400);

    const apiKey = Deno.env.get("UDDOKTAPAY_API_KEY")!;
    const baseUrl = (Deno.env.get("UDDOKTAPAY_BASE_URL") ?? "").replace(/\/$/, "");
    const verifyResp = await fetch(`${baseUrl}/verify-payment`, {
      method: "POST",
      headers: {
        "RT-UDDOKTAPAY-API-KEY": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ invoice_id: invoiceId }),
    });
    const verified = await verifyResp.json().catch(() => ({}));
    if (!verifyResp.ok) {
      console.error("uddoktapay verify failed", verifyResp.status, verified);
      return json({ error: "verify failed" }, 502);
    }
    const status = String(verified?.status ?? "").toUpperCase();
    if (status !== "COMPLETED") {
      return json({ ok: true, status, credited: false });
    }

    const { data: approved, error: rpcErr } = await admin.rpc(
      "system_approve_addmoney_request",
      { p_request_id: requestId, p_gateway_ref: String(invoiceId) },
    );
    if (rpcErr) {
      console.error("system_approve_addmoney_request failed", rpcErr);
      return json({ error: rpcErr.message }, 500);
    }
    return json({ ok: true, status: "COMPLETED", credited: true, addmoney: approved });
  } catch (e) {
    console.error("uddoktapay-confirm-addmoney error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

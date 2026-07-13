// Scheduled reconciliation: finds pending uddoktapay add-money fund_requests
// with an invoice_id, verifies the payment with UddoktaPay, and credits the
// user's balance via system_approve_addmoney_request when COMPLETED.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

async function verifyPrivilegedCaller(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const cronHeader = req.headers.get("x-cron-secret") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (cronSecret && (cronHeader === cronSecret || authHeader === `Bearer ${cronSecret}`)) return true;
  if (serviceKey && authHeader === `Bearer ${serviceKey}`) return true;
  if (!authHeader.startsWith("Bearer ")) return false;
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const uc = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: c } = await uc.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!c?.claims?.sub) return false;
    const ac = createClient(url, serviceKey);
    const { data } = await ac.from("user_roles").select("id").eq("user_id", c.claims.sub as string).eq("role", "admin").maybeSingle();
    return !!data;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!(await verifyPrivilegedCaller(req))) return json({ error: "Unauthorized" }, 401);
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const apiKey = Deno.env.get("UDDOKTAPAY_API_KEY");
    const baseUrl = (Deno.env.get("UDDOKTAPAY_BASE_URL") ?? "").replace(/\/$/, "");
    if (!apiKey || !baseUrl) return json({ error: "UddoktaPay not configured" }, 500);

    // Look at last 24h of pending uddoktapay requests that have an invoice id
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await admin
      .from("fund_requests")
      .select("id,user_id,amount,transaction_id_proof,created_at")
      .eq("type", "add_money")
      .eq("status", "pending")
      .eq("source_method", "uddoktapay")
      .not("transaction_id_proof", "is", null)
      .gte("created_at", since)
      .limit(100);
    if (error) return json({ error: error.message }, 500);

    const results: any[] = [];
    for (const r of rows ?? []) {
      const invoiceId = r.transaction_id_proof!;
      try {
        const vr = await fetch(`${baseUrl}/verify-payment`, {
          method: "POST",
          headers: {
            "RT-UDDOKTAPAY-API-KEY": apiKey,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({ invoice_id: invoiceId }),
        });
        const verified = await vr.json().catch(() => ({}));
        const status = String(verified?.status ?? "").toUpperCase();
        if (status !== "COMPLETED") {
          await admin.from("addmoney_reconciliation_log").insert({
            request_id: r.id, invoice_id: invoiceId, status: "skipped",
            detail: { verify_status: status },
          });
          results.push({ id: r.id, action: "skipped", status });
          continue;
        }
        const { data: approved, error: rpcErr } = await admin.rpc(
          "system_approve_addmoney_request",
          { p_request_id: r.id, p_gateway_ref: invoiceId },
        );
        if (rpcErr) throw rpcErr;
        await admin.from("addmoney_reconciliation_log").insert({
          request_id: r.id, invoice_id: invoiceId, status: "credited",
          detail: approved as any,
        });
        results.push({ id: r.id, action: "credited" });
      } catch (e) {
        await admin.from("addmoney_reconciliation_log").insert({
          request_id: r.id, invoice_id: invoiceId, status: "error",
          detail: { error: (e as Error).message },
        });
        results.push({ id: r.id, action: "error", error: (e as Error).message });
      }
    }

    return json({ ok: true, scanned: rows?.length ?? 0, results });
  } catch (e) {
    console.error("reconcile-addmoney error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

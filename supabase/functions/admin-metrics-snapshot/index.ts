import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_ROLES = ["admin", "compliance", "risk", "audit", "finance"];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CRON_SECRET = Deno.env.get("ADMIN_METRICS_CRON_SECRET") ?? "";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfDay(dateStr: string) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}
function endOfDay(dateStr: string) {
  return new Date(`${dateStr}T23:59:59.999Z`);
}

/** Compute every metric AS OF the end of `snapshotDate` (UTC). */
async function computeSnapshot(admin: ReturnType<typeof createClient>, snapshotDate: string) {
  const asOf = endOfDay(snapshotDate).toISOString();
  const day1Cutoff = new Date(endOfDay(snapshotDate).getTime() - 1 * 86400000).toISOString();
  const day7Cutoff = new Date(endOfDay(snapshotDate).getTime() - 7 * 86400000).toISOString();
  const day30Cutoff = new Date(endOfDay(snapshotDate).getTime() - 30 * 86400000).toISOString();
  const day60Cutoff = new Date(endOfDay(snapshotDate).getTime() - 60 * 86400000).toISOString();
  const min15Cutoff = new Date(endOfDay(snapshotDate).getTime() - 15 * 60 * 1000).toISOString();

  const [
    txns,
    profiles,
    merchants,
    agents,
    orders,
    fraud,
    kyc,
    complaints,
    gateways,
    rechargeApis,
    activeUsers60d,
  ] = await Promise.all([
    admin.from("transactions").select("type,amount,fee,commission,status,created_at,user_id").gte("created_at", day30Cutoff).lte("created_at", asOf).limit(2000),
    admin.from("profiles").select("user_id,created_at,status,balance").not("phone", "like", "staff-%").lte("created_at", asOf).limit(2000),
    admin.from("merchants").select("id,user_id,status,category,created_at").lte("created_at", asOf).limit(1000),
    admin.from("agents").select("status,float_balance,created_at").lte("created_at", asOf).limit(1000),
    admin.from("orders").select("total,status,created_at,merchant_id,user_id").gte("created_at", day30Cutoff).lte("created_at", asOf).limit(1000),
    admin.from("fraud_alerts").select("status,severity,created_at").gte("created_at", day30Cutoff).lte("created_at", asOf).limit(500),
    admin.from("kyc_verifications").select("status,created_at").lte("created_at", asOf).limit(2000),
    admin.from("support_complaints").select("id,status").in("status", ["open", "in_progress"]).limit(500),
    admin.from("payment_gateways").select("is_active,status").limit(50),
    admin.from("recharge_api_configs").select("is_active,test_status").limit(50),
    admin.from("transactions").select("user_id,created_at").gte("created_at", day60Cutoff).lte("created_at", asOf).limit(4000),
  ]);

  const txn = txns.data ?? [];
  const prof = profiles.data ?? [];
  const merch = merchants.data ?? [];
  const ag = agents.data ?? [];
  const ord = orders.data ?? [];
  const fr = fraud.data ?? [];
  const kycRows = kyc.data ?? [];
  const comps = complaints.data ?? [];
  const gw = gateways.data ?? [];
  const rapis = rechargeApis.data ?? [];
  const active60 = activeUsers60d.data ?? [];

  // --- Cohorts: retention based on profiles created in earlier windows
  const usersByCreated = (cutoff: string) =>
    prof.filter((p: any) => p.created_at && p.created_at <= cutoff).map((p: any) => p.user_id);
  const txnUsersAfter = (cutoff: string) =>
    new Set(active60.filter((t: any) => t.created_at >= cutoff).map((t: any) => t.user_id));

  const ret = (windowCutoff: string) => {
    const cohort = usersByCreated(windowCutoff);
    if (cohort.length === 0) return { cohort: 0, retained: 0, rate: 0 };
    const active = txnUsersAfter(windowCutoff);
    const retained = cohort.filter((u: string) => active.has(u)).length;
    return { cohort: cohort.length, retained, rate: +(retained / cohort.length * 100).toFixed(1) };
  };

  const cohorts = {
    day1: ret(day1Cutoff),
    day7: ret(day7Cutoff),
    day30: ret(day30Cutoff),
    kyc_completion: kycRows.length > 0
      ? +((kycRows.filter((k: any) => k.status === "approved").length / kycRows.length) * 100).toFixed(1)
      : 0,
  };

  // --- Predictive
  const activeUserSet = new Set(txn.map((t: any) => t.user_id));
  const churnCandidates = prof.filter((p: any) => p.status === "active" && !activeUserSet.has(p.user_id)).length;
  const inactiveMerchants = merch.filter((m: any) => m.status !== "active").length;
  const lowFloatAgents = ag.filter((a: any) => Number(a.float_balance ?? 0) < 5000).length;

  const predictive = {
    churn_candidates_30d: churnCandidates,
    inactive_merchants: inactiveMerchants,
    low_float_agents: lowFloatAgents,
    open_fraud_alerts: fr.filter((f: any) => f.status === "open").length,
    pending_kyc: kycRows.filter((k: any) => k.status === "pending").length,
  };

  // --- Ops Wall
  const gwHealthy = gw.filter((g: any) => g.is_active && (g.status ?? "ok") !== "down").length;
  const gwTotal = gw.length;
  const rapiOk = rapis.filter((r: any) => r.is_active && r.test_status !== "failed").length;
  const rapiTotal = rapis.length;

  // Spike detection: merchants whose order count today is >2σ above merchant mean
  const ordersByMerchant: Record<string, number> = {};
  for (const o of ord) {
    if (!o.merchant_id) continue;
    if (o.created_at < day1Cutoff) continue;
    ordersByMerchant[o.merchant_id] = (ordersByMerchant[o.merchant_id] ?? 0) + 1;
  }
  const counts = Object.values(ordersByMerchant);
  const mean = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
  const variance = counts.length
    ? counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length
    : 0;
  const stddev = Math.sqrt(variance);
  const merchantSpikes = counts.filter((c) => c > mean + 2 * stddev && c > 5).length;

  const ops_wall = {
    gateways_healthy: gwHealthy,
    gateways_total: gwTotal,
    gateway_health_pct: gwTotal ? +((gwHealthy / gwTotal) * 100).toFixed(1) : 0,
    recharge_apis_ok: rapiOk,
    recharge_apis_total: rapiTotal,
    recharge_health_pct: rapiTotal ? +((rapiOk / rapiTotal) * 100).toFixed(1) : 0,
    open_complaints: comps.length,
    merchant_spikes: merchantSpikes,
  };

  // --- Totals (lightweight headline numbers)
  const totals = {
    total_users: prof.length,
    active_users: prof.filter((p: any) => p.status === "active").length,
    total_merchants: merch.length,
    total_agents: ag.length,
    txn_count_30d: txn.length,
    txn_volume_30d: txn.reduce((s: number, t: any) => s + Number(t.amount ?? 0), 0),
    order_count_30d: ord.length,
    order_volume_30d: ord.reduce((s: number, t: any) => s + Number(t.total ?? 0), 0),
  };

  return { cohorts, predictive, ops_wall, totals };
}

async function isAuthorizedAdmin(authHeader: string): Promise<{ ok: boolean; userId?: string }> {
  if (!authHeader) return { ok: false };
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) return { ok: false };
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  const has = (roles ?? []).some((r: any) => ADMIN_ROLES.includes(r.role));
  return { ok: has, userId: user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const cronHeader = req.headers.get("x-cron-secret") ?? "";
    const isCron = CRON_SECRET && cronHeader === CRON_SECRET;

    // Service-role bearer also counts as a trusted system caller (used by pg_cron)
    const authHeader = req.headers.get("authorization") ?? "";
    const isServiceRole = authHeader === `Bearer ${SERVICE_ROLE}`;

    let actorId: string | undefined;
    if (!isCron && !isServiceRole) {
      const authz = await isAuthorizedAdmin(authHeader);
      if (!authz.ok) {
        return json(403, { error: "Forbidden", code: "ADMIN_REQUIRED" });
      }
      actorId = authz.userId;
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = url.searchParams.get("action") ?? body.action ?? "snapshot";
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (action === "backfill") {
      const days = Math.min(Math.max(Number(body.days ?? 30), 1), 60);
      const results: Array<{ date: string; ok: boolean; error?: string }> = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const date = dayKey(d);
        try {
          const snap = await computeSnapshot(admin, date);
          const { error } = await admin.from("admin_daily_metrics_snapshots").upsert(
            { snapshot_date: date, generated_by: actorId ?? null, generated_at: new Date().toISOString(), ...snap },
            { onConflict: "snapshot_date" },
          );
          if (error) throw error;
          results.push({ date, ok: true });
        } catch (e) {
          results.push({ date, ok: false, error: (e as Error).message });
        }
      }
      return json(200, { ok: true, results });
    }

    // single-day snapshot (default = today UTC)
    const date = (body.date as string) ?? dayKey(new Date());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json(400, { error: "Invalid date, expected YYYY-MM-DD" });
    }
    const snap = await computeSnapshot(admin, date);
    const { error } = await admin.from("admin_daily_metrics_snapshots").upsert(
      { snapshot_date: date, generated_by: actorId ?? null, generated_at: new Date().toISOString(), ...snap },
      { onConflict: "snapshot_date" },
    );
    if (error) throw error;
    return json(200, { ok: true, date, snapshot: snap });
  } catch (e) {
    console.error("admin-metrics-snapshot error", e);
    return json(500, { error: (e as Error).message });
  }
});

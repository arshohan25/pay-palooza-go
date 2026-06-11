import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

let cachedSecret: string | null = null;
let cachedAt = 0;
async function getVaultSecret(admin: ReturnType<typeof createClient>): Promise<string> {
  if (cachedSecret && Date.now() - cachedAt < 5 * 60_000) return cachedSecret;
  const { data } = await admin.rpc("get_autosave_cron_secret");
  if (typeof data === "string") { cachedSecret = data; cachedAt = Date.now(); return data; }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const webhookUrl = Deno.env.get("CRON_ALERT_WEBHOOK_URL") ?? "";
  const envCronSecret = Deno.env.get("ADMIN_METRICS_CRON_SECRET") ?? "";

  const admin = createClient(supabaseUrl, serviceKey);

  // Auth: cron secret OR admin bearer
  const cronHeader = req.headers.get("x-cron-secret") ?? "";
  let isAuthorized = false;
  if (cronHeader.length >= 16) {
    if (envCronSecret && safeEq(cronHeader, envCronSecret)) isAuthorized = true;
    else {
      const vault = await getVaultSecret(admin);
      if (vault && safeEq(cronHeader, vault)) isAuthorized = true;
    }
  }
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!isAuthorized && authHeader.startsWith("Bearer ")) {
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await userClient.auth.getClaims(token);
    const uid = claims?.claims?.sub;
    if (uid) {
      const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
      if (roleRow) isAuthorized = true;
    }
  }
  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Find stalled schedules: active, not settled, next_run_at older than 24h
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: stalled, error } = await admin
    .from("savings_auto_save")
    .select("id, user_id, frequency, amount, next_run_at, last_run_at, total_paid, total_installments")
    .eq("is_active", true)
    .eq("settled", false)
    .lt("next_run_at", cutoff);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const stalledList = stalled ?? [];
  const detectedAt = new Date().toISOString();
  const newlyAlerted: any[] = [];

  // Resolve a system admin to attribute notifications to (admin_notifications.admin_id is NOT NULL)
  const { data: anAdmin } = await admin.from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
  const systemAdminId = anAdmin?.user_id ?? null;

  for (const s of stalledList) {
    // Dedupe: skip if alerted within last 24h
    const { data: prior } = await admin.from("cron_alert_state").select("last_alerted_at, alert_count").eq("schedule_id", s.id).maybeSingle();
    if (prior?.last_alerted_at) {
      const ageMs = Date.now() - new Date(prior.last_alerted_at).getTime();
      if (ageMs < 24 * 60 * 60 * 1000) continue;
    }

    // Upsert alert state
    await admin.from("cron_alert_state").upsert({
      schedule_id: s.id,
      last_alerted_at: detectedAt,
      alert_count: (prior?.alert_count ?? 0) + 1,
    }, { onConflict: "schedule_id" });

    // In-app admin notification
    try {
      await admin.from("admin_notifications").insert({
        title: "⚠️ DPS schedule stalled",
        message: `Schedule ${s.id.substring(0, 8)} (${s.frequency}, ৳${s.amount}) next_run_at hasn't advanced for 24h+.`,
        severity: "warning",
        category: "cron_health",
        metadata: { schedule_id: s.id, next_run_at: s.next_run_at, user_id: s.user_id },
      });
    } catch (e) {
      console.error("admin_notifications insert failed:", e);
    }

    newlyAlerted.push(s);
  }

  // Webhook (optional, single batch payload)
  if (webhookUrl && newlyAlerted.length > 0) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "cron_stall_detected", detected_at: detectedAt, count: newlyAlerted.length, stalled: newlyAlerted }),
      });
    } catch (e) {
      console.error("webhook failed:", e);
    }
  }

  return new Response(JSON.stringify({ checked: stalledList.length, alerted: newlyAlerted.length, detected_at: detectedAt }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

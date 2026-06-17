import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Outcome =
  | "collected"
  | "missed"
  | "settled"
  | "dedup_skipped"
  | "no_goal"
  | "plan_expired"
  | "schedule_inactive"
  | "schedule_not_found";

type AuthMethod = "vault_secret" | "env_secret" | "bearer_user" | "bearer_admin" | "none";
type TriggeredBy = "cron" | "user" | "admin" | "retry";

function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const FORCE_COOLDOWN_MS = 30_000;
const forceLastRun = new Map<string, number>();
function checkForceRateLimit(actor: string, scope: string): { ok: boolean; retryAfterMs: number } {
  const key = `${actor}:${scope}`;
  const now = Date.now();
  const last = forceLastRun.get(key) ?? 0;
  const delta = now - last;
  if (delta < FORCE_COOLDOWN_MS) return { ok: false, retryAfterMs: FORCE_COOLDOWN_MS - delta };
  forceLastRun.set(key, now);
  if (forceLastRun.size > 500) {
    for (const [k, t] of forceLastRun) if (now - t > 10 * 60_000) forceLastRun.delete(k);
  }
  return { ok: true, retryAfterMs: 0 };
}

let cachedVaultCronSecret: string | null = null;
let cachedVaultCronSecretAt = 0;
const VAULT_CACHE_TTL_MS = 5 * 60 * 1000;
async function getVaultCronSecret(adminClient: ReturnType<typeof createClient>): Promise<string> {
  const now = Date.now();
  if (cachedVaultCronSecret && now - cachedVaultCronSecretAt < VAULT_CACHE_TTL_MS) return cachedVaultCronSecret;
  const { data, error } = await adminClient.rpc("get_autosave_cron_secret");
  if (error || !data || typeof data !== "string") return "";
  cachedVaultCronSecret = data;
  cachedVaultCronSecretAt = now;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  // Mutable state captured for logging in finally
  let triggeredBy: TriggeredBy = "user";
  let authMethod: AuthMethod = "none";
  let statusCode = 500;
  let processed = 0, skipped = 0, settled = 0, missed = 0, dedup = 0, scheduleCount = 0;
  let errorCode: string | null = null;
  let errorMessage: string | null = null;
  let logClient: ReturnType<typeof createClient> | null = null;
  let backfillMeta: any = null;

  const respond = (status: number, payload: unknown) => {
    statusCode = status;
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId },
    });
  };
  const jsonError = (status: number, code: string, message: string) => {
    errorCode = code;
    errorMessage = message;
    return respond(status, { error: { code, message } });
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const envCronSecret = Deno.env.get("ADMIN_METRICS_CRON_SECRET") ?? "";

    if (!serviceKey || !anonKey) return jsonError(500, "MISCONFIGURED", "Server is missing required configuration");

    logClient = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const cronHeader = req.headers.get("x-cron-secret") ?? "";

    let isCron = false;
    if (cronHeader.length >= 16) {
      if (envCronSecret.length >= 16 && safeEq(cronHeader, envCronSecret)) {
        isCron = true;
        authMethod = "env_secret";
      } else {
        const vaultSecret = await getVaultCronSecret(logClient);
        if (vaultSecret.length >= 16 && safeEq(cronHeader, vaultSecret)) {
          isCron = true;
          authMethod = "vault_secret";
        }
      }
    }

    const hasBearer = authHeader.startsWith("Bearer ") && authHeader.length > 20;
    if (!isCron && !hasBearer) return jsonError(401, "UNAUTHORIZED", "Unauthorized");

    let body: { schedule_id?: string; force?: boolean; mode?: "backfill"; retry?: boolean } = {};
    try {
      if (req.headers.get("content-type")?.includes("application/json")) body = await req.json();
    } catch (_) { /* no body */ }

    if (body.schedule_id !== undefined && typeof body.schedule_id !== "string") {
      return jsonError(400, "BAD_REQUEST", "schedule_id must be a string");
    }
    if (body.schedule_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.schedule_id)) {
      return jsonError(400, "BAD_REQUEST", "schedule_id must be a UUID");
    }

    let callerUserId: string | null = null;
    let callerIsAdmin = false;
    if (!isCron && hasBearer) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claims?.claims?.sub) return jsonError(401, "UNAUTHORIZED", "Invalid or expired token");
      callerUserId = claims.claims.sub;
      const { data: roleRow, error: roleErr } = await logClient
        .from("user_roles").select("role").eq("user_id", callerUserId).eq("role", "admin").maybeSingle();
      if (roleErr) return jsonError(500, "INTERNAL_ERROR", "Failed to resolve role");
      callerIsAdmin = !!roleRow;
      authMethod = callerIsAdmin ? "bearer_admin" : "bearer_user";
    }

    triggeredBy = isCron ? (body.retry ? "retry" : "cron") : callerIsAdmin ? "admin" : "user";

    if (body.force && !callerIsAdmin) return jsonError(403, "FORBIDDEN_ADMIN_REQUIRED", "force requires admin role");
    const force = !!body.force && callerIsAdmin;

    // Backfill mode: admin or cron only
    const isBackfill = body.mode === "backfill";
    if (isBackfill && !callerIsAdmin && !isCron) {
      return jsonError(403, "FORBIDDEN", "backfill requires admin or cron");
    }

    if (force) {
      const scope = body.schedule_id ?? "all";
      const rl = checkForceRateLimit(callerUserId ?? "anon", scope);
      if (!rl.ok) {
        errorCode = "RATE_LIMITED";
        errorMessage = "Forced runs throttled";
        statusCode = 429;
        return new Response(
          JSON.stringify({ error: { code: "RATE_LIMITED", message: `Forced runs are limited to one per ${Math.round(FORCE_COOLDOWN_MS / 1000)}s per scope` } }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)), "x-request-id": requestId } },
        );
      }
    }

    const supabase = logClient!;

    // Resolve target schedules
    let schedulesQuery = supabase.from("savings_auto_save").select("*");
    if (body.schedule_id) {
      schedulesQuery = schedulesQuery.eq("id", body.schedule_id);
    } else if (isBackfill) {
      // Backfill: only schedules overdue by > 24h
      schedulesQuery = schedulesQuery
        .eq("is_active", true)
        .lt("next_run_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    } else {
      schedulesQuery = schedulesQuery
        .eq("is_active", true)
        .lte("next_run_at", new Date().toISOString());
    }
    const { data: schedules, error: fetchErr } = await schedulesQuery;
    if (fetchErr) throw fetchErr;
    scheduleCount = (schedules ?? []).length;

    if (body.schedule_id && schedules && schedules.length > 0 && !isCron) {
      const own = schedules[0].user_id === callerUserId;
      if (!own && !callerIsAdmin) return jsonError(403, "FORBIDDEN", "You do not own this schedule");
    }

    const perSchedule: Array<{ schedule_id: string; outcome: Outcome; reason?: string; cycles?: number }> = [];

    // ---- Per-schedule single-cycle processor (returns outcome) ----
    const runCycle = async (schedule: any): Promise<{ outcome: Outcome; reason: string; updatedSchedule: any | null }> => {
      const log = async (
        outcome: Outcome,
        reason: string,
        amount: number,
        extra?: { goal_id?: string | null; goal_name?: string | null; tx_reference?: string | null; transaction_id?: string | null },
      ) => {
        try {
          await supabase.from("dps_run_log").insert({
            schedule_id: schedule.id,
            user_id: schedule.user_id,
            outcome, reason, amount,
            triggered_by: triggeredBy,
            goal_id: extra?.goal_id ?? null,
            goal_name: extra?.goal_name ?? null,
            tx_reference: extra?.tx_reference ?? null,
            transaction_id: extra?.transaction_id ?? null,
          });
        } catch (_) { /* best-effort */ }
      };

      const sendPush = async (user_id: string, category: string, title: string, bodyTxt: string) => {
        try {
          const { data: allowed } = await supabase.rpc("should_send_push", { p_user_id: user_id, p_category: category });
          if (allowed !== true) return;
          await supabase.functions.invoke("send-push-notification", {
            body: { user_ids: [user_id], title, body: bodyTxt, url: "/savings" },
          });
        } catch (_) { /* best-effort */ }
      };

      if (body.schedule_id && !schedule.is_active && !force) {
        await log("schedule_inactive", "Schedule is paused", 0);
        return { outcome: "schedule_inactive", reason: "paused", updatedSchedule: null };
      }

      if (!force && !isBackfill && schedule.last_run_at) {
        const last = new Date(schedule.last_run_at).getTime();
        const minGap = schedule.frequency === "daily" ? 20 * 60 * 60 * 1000
          : schedule.frequency === "weekly" ? 6 * 24 * 60 * 60 * 1000
          : 27 * 24 * 60 * 60 * 1000;
        if (Date.now() - last < minGap) {
          await log("dedup_skipped", "Within cycle window", 0);
          return { outcome: "dedup_skipped", reason: "within window", updatedSchedule: null };
        }
      }

      if (schedule.ends_at && new Date(schedule.ends_at) <= new Date()) {
        await supabase.from("savings_auto_save").update({
          is_active: false, settled: true, updated_at: new Date().toISOString(),
        }).eq("id", schedule.id);
        await supabase.from("notifications").insert({
          user_id: schedule.user_id,
          title: "✅ DPS Plan Completed",
          body: `Your ৳${schedule.amount}/${schedule.frequency} DPS plan has completed. Total paid: ${schedule.total_paid ?? 0} installments.`,
          category: "savings",
        });
        await sendPush(schedule.user_id, "savings_collected", "✅ DPS Plan Completed", `Your DPS plan has finished. ${schedule.total_paid ?? 0} installments paid.`);
        await log("settled", "ends_at reached", 0);
        return { outcome: "settled", reason: "ends_at", updatedSchedule: null };
      }

      const goalId: string | null = schedule.goal_id ?? null;
      if (!goalId) {
        await log("no_goal", "Schedule has no linked goal_id", 0);
        return { outcome: "no_goal", reason: "no goal", updatedSchedule: null };
      }

      const nextRun = new Date();
      if (schedule.frequency === "daily") nextRun.setDate(nextRun.getDate() + 1);
      else if (schedule.frequency === "weekly") nextRun.setDate(nextRun.getDate() + 7);
      else nextRun.setMonth(nextRun.getMonth() + 1);

      // Atomic debit; if it fails, treat as insufficient funds.
      let newBalance: number | null = null;
      const { data: debitedBal, error: debitErr } = await supabase.rpc("debit_user_balance", {
        p_user_id: schedule.user_id,
        p_amount: Number(schedule.amount),
      });
      if (!debitErr && debitedBal != null) newBalance = Number(debitedBal);

      if (newBalance === null) {
        await supabase.from("dps_missed_payments").insert({
          schedule_id: schedule.id, user_id: schedule.user_id, amount: schedule.amount, due_date: new Date().toISOString(),
        });
        const updated = {
          missed_count: (schedule.missed_count ?? 0) + 1,
          last_missed_at: new Date().toISOString(),
          next_run_at: nextRun.toISOString(),
          last_run_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await supabase.from("savings_auto_save").update(updated).eq("id", schedule.id);
        const t = "⚠️ DPS Installment Missed";
        const b = `Insufficient balance for ৳${schedule.amount} DPS installment. You can repay later from Savings > Active Plans.`;
        await supabase.from("notifications").insert({ user_id: schedule.user_id, title: t, body: b, category: "savings" });
        await sendPush(schedule.user_id, "savings_missed", t, b);
        await log("missed", "Insufficient balance", Number(schedule.amount));
        return { outcome: "missed", reason: "insufficient balance", updatedSchedule: { ...schedule, ...updated } };
      }

      const { data: goal } = await supabase.from("savings_goals").select("*").eq("id", goalId).single();
      if (!goal || goal.status !== "active") {
        // Refund the debit so we don't keep money against a no-longer-active goal.
        await supabase.rpc("credit_user_balance", { p_user_id: schedule.user_id, p_amount: Number(schedule.amount) });
        await log("no_goal", "Goal not active", 0);
        return { outcome: "no_goal", reason: "goal inactive", updatedSchedule: null };
      }

      const newSaved = Number(goal.saved_amount) + Number(schedule.amount);
      const completed = newSaved >= Number(goal.target_amount);


      await supabase.from("savings_goals").update({
        saved_amount: newSaved, status: completed ? "completed" : "active", updated_at: new Date().toISOString(),
      }).eq("id", goalId);
      await supabase.from("savings_deposits").insert({
        goal_id: goalId, user_id: schedule.user_id, amount: schedule.amount, source: triggeredBy === "cron" || triggeredBy === "retry" ? "auto" : "manual",
      });

      const txRef = `DPS-INST-${schedule.id.substring(0, 8)}-${(schedule.total_paid ?? 0) + 1}`;
      const { data: txRow } = await supabase.from("transactions").insert({
        user_id: schedule.user_id, type: "payment", amount: schedule.amount, fee: 0,
        description: `DPS Installment: ${goal.name} (#${(schedule.total_paid ?? 0) + 1})`,
        reference: txRef, status: "completed", balance_after: newBalance,
      }).select("id").single();

      const newTotalPaid = (schedule.total_paid ?? 0) + 1;
      const reachedFinal = !!schedule.total_installments && newTotalPaid >= Number(schedule.total_installments);
      const updatedSch = {
        next_run_at: nextRun.toISOString(),
        last_run_at: new Date().toISOString(),
        total_paid: newTotalPaid,
        is_active: reachedFinal ? false : schedule.is_active,
        settled: reachedFinal ? true : (schedule.settled ?? false),
        updated_at: new Date().toISOString(),
      };
      await supabase.from("savings_auto_save").update(updatedSch).eq("id", schedule.id);

      const successTitle = completed ? "🎉 Goal Completed!" : "✅ DPS Installment Collected";
      const successBody = `৳${schedule.amount} ${triggeredBy === "cron" || triggeredBy === "retry" ? "auto-collected" : "collected"} to "${goal.name}"${completed ? " — Goal completed!" : `. Installment ${newTotalPaid}/${schedule.total_installments ?? "∞"}`}`;
      await supabase.from("notifications").insert({ user_id: schedule.user_id, title: successTitle, body: successBody, category: "savings" });
      await sendPush(schedule.user_id, "savings_collected", successTitle, successBody);
      await log("collected", `Collected to ${goal.name}`, Number(schedule.amount), {
        goal_id: goalId, goal_name: goal.name, tx_reference: txRef, transaction_id: txRow?.id ?? null,
      });
      return {
        outcome: reachedFinal ? "settled" : "collected",
        reason: reachedFinal ? "final installment" : "ok",
        updatedSchedule: { ...schedule, ...updatedSch },
      };
    };

    // Iterate schedules. In backfill mode, replay cycles until caught up.
    const MAX_BACKFILL_CYCLES = 10;
    for (const sched of schedules ?? []) {
      let cur = sched;
      let cycles = 0;
      while (true) {
        const { outcome, updatedSchedule } = await runCycle(cur);
        cycles++;
        if (outcome === "collected") processed++;
        else if (outcome === "missed") missed++;
        else if (outcome === "settled") settled++;
        else if (outcome === "dedup_skipped") dedup++;
        else skipped++;

        if (!isBackfill) {
          perSchedule.push({ schedule_id: cur.id, outcome });
          break;
        }
        if (cycles >= MAX_BACKFILL_CYCLES) { perSchedule.push({ schedule_id: cur.id, outcome, cycles }); break; }
        if (!updatedSchedule) { perSchedule.push({ schedule_id: cur.id, outcome, cycles }); break; }
        // Stop if next_run_at is now caught up
        if (new Date(updatedSchedule.next_run_at).getTime() > Date.now() - 24 * 60 * 60 * 1000) {
          perSchedule.push({ schedule_id: cur.id, outcome, cycles });
          break;
        }
        // Stop on terminal outcomes
        if (outcome === "settled" || outcome === "no_goal" || outcome === "schedule_inactive") {
          perSchedule.push({ schedule_id: cur.id, outcome, cycles });
          break;
        }
        cur = updatedSchedule;
      }
    }

    if (isBackfill) backfillMeta = { cycles_total: perSchedule.reduce((a, p) => a + (p.cycles ?? 1), 0) };

    return respond(200, { processed, skipped, settled, missed, dedup, triggeredBy, perSchedule, total: scheduleCount, mode: isBackfill ? "backfill" : "tick" });
  } catch (err: any) {
    console.error("process-auto-save error:", err);
    errorCode = errorCode ?? "INTERNAL_ERROR";
    errorMessage = errorMessage ?? (err?.message ?? "Internal server error");
    return respond(500, { error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
  } finally {
    // Best-effort structured log
    try {
      if (logClient) {
        await logClient.rpc("log_cron_invocation", {
          p_function: "process-auto-save",
          p_triggered_by: triggeredBy,
          p_auth_method: authMethod,
          p_status_code: statusCode,
          p_processed: processed,
          p_skipped: skipped,
          p_settled: settled,
          p_missed: missed,
          p_dedup: dedup,
          p_schedule_count: scheduleCount,
          p_duration_ms: Date.now() - startedAt,
          p_request_id: requestId,
          p_error_code: errorCode,
          p_error_message: errorMessage,
          p_meta: backfillMeta,
        });
      }
    } catch (e) {
      console.error("log_cron_invocation failed:", e);
    }
  }
});

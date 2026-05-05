import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
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

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Constant-time string comparison to avoid timing attacks on the cron secret
function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// In-memory rate limit for `force` runs (per-instance only — best-effort).
// Key: `${actor}:${scope}` -> last-run timestamp (ms).
const FORCE_COOLDOWN_MS = 30_000; // 30s between forced runs per admin per scope
const forceLastRun = new Map<string, number>();
function checkForceRateLimit(actor: string, scope: string): { ok: boolean; retryAfterMs: number } {
  const key = `${actor}:${scope}`;
  const now = Date.now();
  const last = forceLastRun.get(key) ?? 0;
  const delta = now - last;
  if (delta < FORCE_COOLDOWN_MS) {
    return { ok: false, retryAfterMs: FORCE_COOLDOWN_MS - delta };
  }
  forceLastRun.set(key, now);
  // Opportunistic cleanup
  if (forceLastRun.size > 500) {
    for (const [k, t] of forceLastRun) {
      if (now - t > 10 * 60_000) forceLastRun.delete(k);
    }
  }
  return { ok: true, retryAfterMs: 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const cronSecret = Deno.env.get("ADMIN_METRICS_CRON_SECRET") ?? "";

    if (!serviceKey || !anonKey) {
      return jsonError(500, "MISCONFIGURED", "Server is missing required configuration");
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const cronHeader = req.headers.get("x-cron-secret") ?? "";

    // Cron auth: require a configured secret AND constant-time match.
    // A bearer header MUST NOT be used to escalate to cron privileges.
    const isCron =
      cronSecret.length >= 16 &&
      cronHeader.length > 0 &&
      safeEq(cronHeader, cronSecret);

    const hasBearer = authHeader.startsWith("Bearer ") && authHeader.length > 20;

    if (!isCron && !hasBearer) {
      return jsonError(401, "UNAUTHORIZED", "Unauthorized");
    }

    // Parse optional body: { schedule_id?, force? }
    let body: { schedule_id?: string; force?: boolean } = {};
    try {
      if (req.headers.get("content-type")?.includes("application/json")) {
        body = await req.json();
      }
    } catch (_) { /* no body */ }

    if (body.schedule_id !== undefined && typeof body.schedule_id !== "string") {
      return jsonError(400, "BAD_REQUEST", "schedule_id must be a string");
    }
    if (body.schedule_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.schedule_id)) {
      return jsonError(400, "BAD_REQUEST", "schedule_id must be a UUID");
    }

    // Resolve caller identity (for user/admin manual triggers).
    // Cron callers are NEVER treated as admins, even if a bearer is also present.
    let callerUserId: string | null = null;
    let callerIsAdmin = false;
    if (!isCron && hasBearer) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claims?.claims?.sub) {
        return jsonError(401, "UNAUTHORIZED", "Invalid or expired token");
      }
      callerUserId = claims.claims.sub;
      const admin = createClient(supabaseUrl, serviceKey);
      const { data: roleRow, error: roleErr } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", callerUserId)
        .eq("role", "admin")
        .maybeSingle();
      if (roleErr) {
        return jsonError(500, "INTERNAL_ERROR", "Failed to resolve role");
      }
      callerIsAdmin = !!roleRow;
    }

    const triggeredBy: "cron" | "user" | "admin" = isCron ? "cron" : callerIsAdmin ? "admin" : "user";

    // `force` is admin-only. Reject (don't silently downgrade) so callers see the failure.
    if (body.force && !callerIsAdmin) {
      return jsonError(403, "FORBIDDEN_ADMIN_REQUIRED", "force requires admin role");
    }
    const force = !!body.force && callerIsAdmin;

    // Rate-limit forced runs per-admin (best-effort, per-instance).
    if (force) {
      const scope = body.schedule_id ?? "all";
      const rl = checkForceRateLimit(callerUserId ?? "anon", scope);
      if (!rl.ok) {
        return new Response(
          JSON.stringify({
            error: {
              code: "RATE_LIMITED",
              message: `Forced runs are limited to one per ${Math.round(FORCE_COOLDOWN_MS / 1000)}s per scope`,
            },
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
            },
          },
        );
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch schedules
    let schedulesQuery = supabase.from("savings_auto_save").select("*");
    if (body.schedule_id) {
      schedulesQuery = schedulesQuery.eq("id", body.schedule_id);
    } else {
      schedulesQuery = schedulesQuery
        .eq("is_active", true)
        .lte("next_run_at", new Date().toISOString());
    }
    const { data: schedules, error: fetchErr } = await schedulesQuery;
    if (fetchErr) throw fetchErr;

    // Authorization for single-schedule manual run
    if (body.schedule_id && schedules && schedules.length > 0 && !isCron) {
      const own = schedules[0].user_id === callerUserId;
      if (!own && !callerIsAdmin) {
        return jsonError(403, "FORBIDDEN", "You do not own this schedule");
      }
    }

    let processed = 0, skipped = 0, settled = 0, missed = 0, dedup = 0;
    const perSchedule: Array<{ schedule_id: string; outcome: Outcome; reason?: string }> = [];

    const log = async (
      schedule: any,
      outcome: Outcome,
      reason: string,
      amount: number,
    ) => {
      perSchedule.push({ schedule_id: schedule.id, outcome, reason });
      try {
        await supabase.from("dps_run_log").insert({
          schedule_id: schedule.id,
          user_id: schedule.user_id,
          outcome,
          reason,
          amount,
          triggered_by: triggeredBy,
        });
      } catch (_) { /* best-effort */ }
    };

    const sendPush = async (user_id: string, title: string, bodyTxt: string) => {
      try {
        await supabase.functions.invoke("send-push-notification", {
          body: { user_ids: [user_id], title, body: bodyTxt, url: "/savings" },
        });
      } catch (_) { /* best-effort */ }
    };

    for (const schedule of schedules ?? []) {
      // Honor inactive when manual single-target
      if (body.schedule_id && !schedule.is_active && !force) {
        await log(schedule, "schedule_inactive", "Schedule is paused", 0);
        skipped++;
        continue;
      }

      // Idempotency guard (skip when force=true)
      if (!force && schedule.last_run_at) {
        const last = new Date(schedule.last_run_at).getTime();
        const minGap = schedule.frequency === "daily" ? 20 * 60 * 60 * 1000
          : schedule.frequency === "weekly" ? 6 * 24 * 60 * 60 * 1000
          : 27 * 24 * 60 * 60 * 1000;
        if (Date.now() - last < minGap) {
          await log(schedule, "dedup_skipped", "Within cycle window", 0);
          dedup++;
          continue;
        }
      }

      // Plan expired
      if (schedule.ends_at && new Date(schedule.ends_at) <= new Date()) {
        await supabase.from("savings_auto_save").update({
          is_active: false,
          settled: true,
          updated_at: new Date().toISOString(),
        }).eq("id", schedule.id);

        await supabase.from("notifications").insert({
          user_id: schedule.user_id,
          title: "✅ DPS Plan Completed",
          body: `Your ৳${schedule.amount}/${schedule.frequency} DPS plan has completed. Total paid: ${schedule.total_paid ?? 0} installments.`,
          category: "savings",
        });
        await sendPush(schedule.user_id, "✅ DPS Plan Completed", `Your DPS plan has finished. ${schedule.total_paid ?? 0} installments paid.`);

        await log(schedule, "settled", "ends_at reached", 0);
        settled++;
        continue;
      }

      // Find target goal
      let goalId = schedule.goal_id;
      if (!goalId) {
        const { data: goals } = await supabase
          .from("savings_goals")
          .select("id")
          .eq("user_id", schedule.user_id)
          .eq("status", "active")
          .limit(1);
        goalId = goals && goals.length > 0 ? goals[0].id : null;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("user_id", schedule.user_id)
        .single();

      const nextRun = new Date();
      if (schedule.frequency === "daily") nextRun.setDate(nextRun.getDate() + 1);
      else if (schedule.frequency === "weekly") nextRun.setDate(nextRun.getDate() + 7);
      else nextRun.setMonth(nextRun.getMonth() + 1);

      if (!profile || Number(profile.balance) < Number(schedule.amount)) {
        await supabase.from("dps_missed_payments").insert({
          schedule_id: schedule.id,
          user_id: schedule.user_id,
          amount: schedule.amount,
          due_date: new Date().toISOString(),
        });

        await supabase.from("savings_auto_save").update({
          missed_count: (schedule.missed_count ?? 0) + 1,
          last_missed_at: new Date().toISOString(),
          next_run_at: nextRun.toISOString(),
          last_run_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", schedule.id);

        const t = "⚠️ DPS Installment Missed";
        const b = `Insufficient balance for ৳${schedule.amount} DPS installment. You can repay later from Savings > Active Plans.`;
        await supabase.from("notifications").insert({
          user_id: schedule.user_id, title: t, body: b, category: "savings",
        });
        await sendPush(schedule.user_id, t, b);
        await log(schedule, "missed", "Insufficient balance", Number(schedule.amount));
        missed++;
        continue;
      }

      if (!goalId) {
        await log(schedule, "no_goal", "No active linked goal", 0);
        skipped++;
        continue;
      }

      const { data: goal } = await supabase
        .from("savings_goals").select("*").eq("id", goalId).single();
      if (!goal || goal.status !== "active") {
        await log(schedule, "no_goal", "Goal not active", 0);
        skipped++;
        continue;
      }

      const newBalance = Number(profile.balance) - Number(schedule.amount);
      const newSaved = Number(goal.saved_amount) + Number(schedule.amount);
      const completed = newSaved >= Number(goal.target_amount);

      await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", schedule.user_id);
      await supabase.from("savings_goals").update({
        saved_amount: newSaved,
        status: completed ? "completed" : "active",
        updated_at: new Date().toISOString(),
      }).eq("id", goalId);

      await supabase.from("savings_deposits").insert({
        goal_id: goalId,
        user_id: schedule.user_id,
        amount: schedule.amount,
        source: triggeredBy === "cron" ? "auto" : "manual",
      });

      await supabase.from("transactions").insert({
        user_id: schedule.user_id,
        type: "payment",
        amount: schedule.amount,
        fee: 0,
        description: `DPS Installment: ${goal.name} (#${(schedule.total_paid ?? 0) + 1})`,
        reference: `DPS-INST-${schedule.id.substring(0, 8)}-${(schedule.total_paid ?? 0) + 1}`,
        status: "completed",
        balance_after: newBalance,
      });

      await supabase.from("savings_auto_save").update({
        next_run_at: nextRun.toISOString(),
        last_run_at: new Date().toISOString(),
        total_paid: (schedule.total_paid ?? 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq("id", schedule.id);

      const successTitle = completed ? "🎉 Goal Completed!" : "✅ DPS Installment Collected";
      const successBody = `৳${schedule.amount} ${triggeredBy === "cron" ? "auto-collected" : "collected"} to "${goal.name}"${completed ? " — Goal completed!" : `. Installment ${(schedule.total_paid ?? 0) + 1}/${schedule.total_installments ?? "∞"}`}`;
      await supabase.from("notifications").insert({
        user_id: schedule.user_id, title: successTitle, body: successBody, category: "savings",
      });
      await sendPush(schedule.user_id, successTitle, successBody);
      await log(schedule, "collected", `Collected to ${goal.name}`, Number(schedule.amount));
      processed++;
    }

    return new Response(
      JSON.stringify({ processed, skipped, settled, missed, dedup, triggeredBy, perSchedule, total: (schedules ?? []).length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("process-auto-save error:", err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
});

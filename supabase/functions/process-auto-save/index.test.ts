// E2E tests for process-auto-save edge function.
// Creates throwaway test users via service role, exercises cron + manual flows,
// and verifies wallet deduction, goal crediting, missed payments, idempotency,
// plan settlement, and realtime publication of savings_auto_save updates.
//
// Requires .env (root) with VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
// and SUPABASE_SERVICE_ROLE_KEY (must be available to the test runtime).

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/process-auto-save`;

if (!SERVICE_KEY) {
  console.warn("SUPABASE_SERVICE_ROLE_KEY missing — tests will be skipped");
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY ?? "");

type Ctx = {
  userId: string;
  email: string;
  goalId: string;
  scheduleId: string;
};

async function createUser(balance: number): Promise<{ userId: string; email: string }> {
  const tag = crypto.randomUUID().substring(0, 8);
  const email = `dpstest_${tag}@easypay.app`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password: `Test_${tag}_pw!`, email_confirm: true,
  });
  if (error || !created.user) throw error ?? new Error("user create failed");
  const userId = created.user.id;
  // upsert profile w/ balance
  await admin.from("profiles").upsert({
    user_id: userId, name: `DPS Test ${tag}`, phone: `01700${Math.floor(100000 + Math.random() * 899999)}`,
    balance,
  } as any, { onConflict: "user_id" });
  return { userId, email };
}

async function createGoal(userId: string, target = 10000): Promise<string> {
  const { data, error } = await admin.from("savings_goals").insert({
    user_id: userId, name: "Test Goal", target_amount: target, saved_amount: 0,
    status: "active", emoji: "🎯",
  } as any).select("id").single();
  if (error || !data) throw error ?? new Error("goal create failed");
  return data.id as string;
}

async function createSchedule(userId: string, goalId: string | null, opts: {
  amount?: number; frequency?: "daily" | "weekly" | "monthly";
  next_run_at?: string; ends_at?: string | null; total_installments?: number;
} = {}): Promise<string> {
  const { data, error } = await admin.from("savings_auto_save").insert({
    user_id: userId,
    goal_id: goalId,
    amount: opts.amount ?? 100,
    frequency: opts.frequency ?? "daily",
    is_active: true,
    next_run_at: opts.next_run_at ?? new Date(Date.now() - 60_000).toISOString(),
    ends_at: opts.ends_at ?? null,
    total_installments: opts.total_installments ?? 30,
    total_paid: 0,
    missed_count: 0,
  } as any).select("id").single();
  if (error || !data) throw error ?? new Error("schedule create failed");
  return data.id as string;
}

async function cleanup(userId: string) {
  await admin.from("dps_run_log").delete().eq("user_id", userId);
  await admin.from("dps_missed_payments").delete().eq("user_id", userId);
  await admin.from("savings_deposits").delete().eq("user_id", userId);
  await admin.from("transactions").delete().eq("user_id", userId);
  await admin.from("savings_auto_save").delete().eq("user_id", userId);
  await admin.from("savings_goals").delete().eq("user_id", userId);
  await admin.from("notifications").delete().eq("user_id", userId);
  await admin.from("profiles").delete().eq("user_id", userId);
  await admin.auth.admin.deleteUser(userId);
}

async function callFn(body: Record<string, unknown> = {}, asService = true): Promise<any> {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${asService ? SERVICE_KEY : ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch (_) { /* ignore */ }
  return { status: res.status, body: json ?? text };
}

const skipIfNoKey = !SERVICE_KEY;

Deno.test({
  name: "1. cron tick — successful collection deducts wallet, credits goal, logs run",
  ignore: skipIfNoKey,
  async fn() {
    const { userId } = await createUser(500);
    try {
      const goalId = await createGoal(userId);
      const scheduleId = await createSchedule(userId, goalId, { amount: 100 });

      const r = await callFn({ schedule_id: scheduleId, force: true });
      assertEquals(r.status, 200, JSON.stringify(r.body));
      assertEquals(r.body.processed, 1);

      const { data: prof } = await admin.from("profiles").select("balance").eq("user_id", userId).single();
      assertEquals(Number(prof?.balance), 400);

      const { data: goal } = await admin.from("savings_goals").select("saved_amount").eq("id", goalId).single();
      assertEquals(Number(goal?.saved_amount), 100);

      const { data: deps } = await admin.from("savings_deposits").select("*").eq("goal_id", goalId);
      assertEquals(deps?.length, 1);

      const { data: txns } = await admin.from("transactions").select("*").eq("user_id", userId);
      assert((txns?.length ?? 0) >= 1);

      const { data: sched } = await admin.from("savings_auto_save").select("total_paid, last_run_at, next_run_at").eq("id", scheduleId).single();
      assertEquals(Number(sched?.total_paid), 1);
      assert(!!sched?.last_run_at);
      assert(new Date(sched?.next_run_at as string).getTime() > Date.now());

      const { data: logs } = await admin.from("dps_run_log").select("*").eq("schedule_id", scheduleId);
      assertEquals(logs?.length, 1);
      assertEquals(logs?.[0].outcome, "collected");

      const { data: notifs } = await admin.from("notifications").select("*").eq("user_id", userId);
      assert((notifs?.length ?? 0) >= 1);
    } finally {
      await cleanup(userId);
    }
  },
});

Deno.test({
  name: "2. insufficient balance → marks missed and increments missed_count",
  ignore: skipIfNoKey,
  async fn() {
    const { userId } = await createUser(10);
    try {
      const goalId = await createGoal(userId);
      const scheduleId = await createSchedule(userId, goalId, { amount: 100 });

      const r = await callFn({ schedule_id: scheduleId, force: true });
      assertEquals(r.status, 200);
      assertEquals(r.body.missed, 1);

      const { data: missed } = await admin.from("dps_missed_payments").select("*").eq("schedule_id", scheduleId);
      assertEquals(missed?.length, 1);

      const { data: sched } = await admin.from("savings_auto_save").select("missed_count").eq("id", scheduleId).single();
      assertEquals(Number(sched?.missed_count), 1);

      const { data: logs } = await admin.from("dps_run_log").select("outcome").eq("schedule_id", scheduleId);
      assertEquals(logs?.[0].outcome, "missed");

      const { data: prof } = await admin.from("profiles").select("balance").eq("user_id", userId).single();
      assertEquals(Number(prof?.balance), 10); // not deducted
    } finally {
      await cleanup(userId);
    }
  },
});

Deno.test({
  name: "3. idempotency — second cron tick within window is dedup_skipped",
  ignore: skipIfNoKey,
  async fn() {
    const { userId } = await createUser(500);
    try {
      const goalId = await createGoal(userId);
      const scheduleId = await createSchedule(userId, goalId, { amount: 100, frequency: "daily" });

      // First run via cron path (no force)
      const r1 = await callFn({ schedule_id: scheduleId });
      assertEquals(r1.body.processed, 1);

      // Second run without force — should dedup
      const r2 = await callFn({ schedule_id: scheduleId });
      assertEquals(r2.body.dedup, 1);
      assertEquals(r2.body.processed, 0);

      const { data: prof } = await admin.from("profiles").select("balance").eq("user_id", userId).single();
      assertEquals(Number(prof?.balance), 400); // only one deduction
    } finally {
      await cleanup(userId);
    }
  },
});

Deno.test({
  name: "4. plan completion — past ends_at marks settled",
  ignore: skipIfNoKey,
  async fn() {
    const { userId } = await createUser(500);
    try {
      const goalId = await createGoal(userId);
      const scheduleId = await createSchedule(userId, goalId, {
        amount: 100, ends_at: new Date(Date.now() - 1000).toISOString(),
      });

      const r = await callFn({ schedule_id: scheduleId, force: true });
      assertEquals(r.body.settled, 1);

      const { data: sched } = await admin.from("savings_auto_save").select("settled, is_active").eq("id", scheduleId).single();
      assertEquals(sched?.settled, true);
      assertEquals(sched?.is_active, false);

      const { data: logs } = await admin.from("dps_run_log").select("outcome").eq("schedule_id", scheduleId);
      assertEquals(logs?.[0].outcome, "settled");
    } finally {
      await cleanup(userId);
    }
  },
});

Deno.test({
  name: "5. force=true bypasses dedup window for manual collect",
  ignore: skipIfNoKey,
  async fn() {
    const { userId } = await createUser(1000);
    try {
      const goalId = await createGoal(userId);
      const scheduleId = await createSchedule(userId, goalId, { amount: 100 });

      const r1 = await callFn({ schedule_id: scheduleId });
      assertEquals(r1.body.processed, 1);

      const r2 = await callFn({ schedule_id: scheduleId, force: true });
      assertEquals(r2.body.processed, 1, "force should bypass dedup");

      const { data: prof } = await admin.from("profiles").select("balance").eq("user_id", userId).single();
      assertEquals(Number(prof?.balance), 800); // two deductions
    } finally {
      await cleanup(userId);
    }
  },
});

Deno.test({
  name: "6. realtime — savings_auto_save UPDATE event reaches subscriber within 5s",
  ignore: skipIfNoKey,
  async fn() {
    const { userId } = await createUser(500);
    try {
      const goalId = await createGoal(userId);
      const scheduleId = await createSchedule(userId, goalId, { amount: 100 });

      const client = createClient(SUPABASE_URL, ANON_KEY, {
        realtime: { params: { eventsPerSecond: 5 } },
      });

      const received = new Promise<boolean>((resolve) => {
        const ch = client.channel(`test-${scheduleId}`)
          .on("postgres_changes", {
            event: "UPDATE", schema: "public", table: "savings_auto_save",
            filter: `id=eq.${scheduleId}`,
          }, () => { resolve(true); client.removeChannel(ch); })
          .subscribe();
        setTimeout(() => { resolve(false); client.removeChannel(ch); }, 5000);
      });

      // small wait to ensure subscription is established
      await new Promise((r) => setTimeout(r, 800));
      await callFn({ schedule_id: scheduleId, force: true });

      const got = await received;
      assert(got, "Did not receive realtime UPDATE on savings_auto_save within 5s");
    } finally {
      await cleanup(userId);
    }
  },
});

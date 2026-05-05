## DPS Flow Audit – Issues Found

After tracing the flow from `SavingsFlow.tsx` → DB → `process-auto-save` / `dps-reminder` edge functions → realtime updates, the DPS pipeline is **not actually running end-to-end**. Specific defects:

1. **`process-auto-save` is never scheduled.** Only `phase4-dps-reminder` exists in `cron.job`. So no installment is ever auto-collected. Existing schedule from Apr 16 has `next_run_at = 2026-04-23` and `total_paid = 0` — proves nothing has run.
2. **First installment never credits the goal.** `handleCreateAutoSave` (SavingsFlow.tsx:528-544) deducts the wallet via `recordTransaction` and sets `total_paid: 1`, but never calls `savings_deposit` RPC nor inserts into `savings_deposits`. Goal `saved_amount` stays 0; user loses ৳ visually.
3. **`savings_auto_save` not in `supabase_realtime` publication.** UI subscribes (line 371) for zero-refresh updates but never receives them. Schedules don't update live after auto-collect/missed.
4. **`process-auto-save` is unauthenticated and unprotected.** No cron-secret check, no service-role validation. Anyone can hit it and trigger processing. Also no idempotency guard — a double invocation in the same minute would double-charge.
5. **No push notification on auto-collect / missed.** `dps-reminder` sends web push, but the actual payment events only insert a `notifications` row.
6. **Repay flow inconsistency.** `handleRepayMissed` only updates `total_paid` when `repayScheduleId` is set (single-schedule context). Multi-schedule repay leaves counters stale.
7. **Goal-less DPS (no `goal_id`) on auto-save:** edge function deducts balance + records transaction but skips the deposit row. Counter is fine, but UI shows installment in plan progress without a deposit trail. Acceptable but should be consistent.

---

## Plan

### 1. Schedule `process-auto-save` (migration)
Add a cron job that runs every 15 minutes (matches the per-day granularity needed and catches schedules across all timezones). Also unschedule any duplicate if present.

```text
SELECT cron.schedule(
  'phase4-process-auto-save',
  '*/15 * * * *',
  $$ SELECT net.http_post(
        url := '.../functions/v1/process-auto-save',
        headers := jsonb_build_object('Content-Type','application/json',
                   'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='ADMIN_METRICS_CRON_SECRET' LIMIT 1)),
        body := '{}'::jsonb
      ); $$);
```

### 2. Add `savings_auto_save` to realtime
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.savings_auto_save;
ALTER TABLE public.savings_auto_save REPLICA IDENTITY FULL;
```

### 3. Fix first-installment credit in `SavingsFlow.tsx`
After successful `savings_auto_save` insert:
- If `linkedGoalId` exists → `supabase.rpc("savings_deposit", { p_goal_id, p_amount: amt, p_source: "auto" })` instead of plain `recordTransaction`.
- If no goal → keep current `recordTransaction` deduction but also insert a `savings_deposits` row with `goal_id: null` (skip if FK requires goal) — fall back to current behavior.
- Use `DPS-INST-{schedule.id.slice(0,8)}-1` reference to match server format.

### 4. Harden `process-auto-save/index.ts`
- Require `x-cron-secret` header (matching `ADMIN_METRICS_CRON_SECRET`) OR a service-role bearer; return 401 otherwise (same pattern as `admin-metrics-snapshot`).
- Add idempotency: skip a schedule if `last_run_at` is within the cycle window (e.g. last_run_at + frequency interval > now()) to avoid double-charging on rapid re-invocation.
- After successful collection, fire web push via `send-push-notification` (best-effort, swallow errors) — same pattern already used by `dps-reminder`.
- Same push for missed payments.

### 5. Fix repay counters in `SavingsFlow.tsx`
`handleRepayMissed`: aggregate `toRepay` by `schedule_id` and update each schedule's `total_paid` and `missed_count`, not only `repayScheduleId`.

### 6. Quick verification after deploy
Manually invoke `process-auto-save` once to drain the overdue schedules created in dev, confirm balances/goals/transactions update live in the UI without refresh.

---

## Files Touched
- New migration: enable realtime + schedule cron job.
- `supabase/functions/process-auto-save/index.ts` — auth guard, idempotency, push notifications.
- `src/components/SavingsFlow.tsx` — first-installment goal credit + multi-schedule repay counters.

No UI redesign, no schema changes beyond publication membership.

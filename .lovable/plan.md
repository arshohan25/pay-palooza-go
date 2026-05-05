## Goal
Make DPS (auto-save) fully observable, manually controllable, and verifiable end-to-end.

## 1. Admin DPS Operations Dashboard
Replace the current minimal `AdminAutoSaveMonitor` with a richer monitoring panel (same `auto_save` tab in `AdminDashboard`).

New columns/sections:
- **Per-schedule row**: user, amount/frequency, total_paid / total_installments, missed_count, `last_run_at`, `next_run_at`, status badge (Active / Paused / Settled / At-Risk if missed_count >= 3).
- **Summary cards**: Active, Settled, Missed today, Due in next 24h, Total ৳/cycle.
- **Filter bar**: status (all/active/paused/settled/at-risk), frequency, search by phone/name.
- **Row actions**:
  - "Run now" → invokes `process-auto-save` Edge Function via `supabase.functions.invoke` with `{ schedule_id }` (see §3).
  - "Pause/Resume" (existing toggle, kept).
  - "View timeline" → drawer showing deposits + missed payments + notifications for that schedule.
- **Recent cron runs panel**: list last 20 entries from a new `dps_run_log` table (function summary: processed/skipped/missed/dedup, per-schedule outcome + skip reason). Shows last processed time at top.

## 2. User-Facing DPS Timeline (real-time)
The existing DPS detail sheet in `SavingsFlow.tsx` already shows a basic paid/missed list. Upgrade it to a vertical timeline with status chips:
- **Collected** (deposit row, source=auto/manual)
- **Missed** (insufficient balance)
- **Repaid** (missed → repaid)
- **Credited to goal** (when linked goal saved_amount increased — derived from deposit row with goal_id)
- **Plan Completed** (when `settled = true`)

Visuals: vertical line + colored dots, date/time, amount, optional note. Already-realtime channels (`savings_auto_save`, `savings_deposits`, `dps_missed_payments`) refresh the list automatically.

## 3. Manual Repay / Collect Now button
Two entry points:
- **Active plans card** in `SavingsFlow.tsx`: small "Collect Now" button on each active, non-settled schedule.
- **Admin row action**: "Run now".

Both call `process-auto-save` with optional `{ schedule_id }` body. Edge function changes:
- Accept JSON body `{ schedule_id?: string, force?: boolean }`.
- If `schedule_id` provided: process only that schedule (single-row fetch, ignoring `next_run_at`).
- Idempotency guard (existing cycle-window check via `last_run_at`) still applies unless `force=true` (admin only — verified by `has_role(admin)` when called with bearer).
- All counters (`total_paid`, `last_run_at`, `next_run_at`, deposits, transactions, notifications, push) reuse the current code path so behaviour matches cron.
- Append a row to new `dps_run_log` per schedule attempt with outcome (`collected | missed | settled | dedup_skipped | no_goal | plan_expired`) + reason text + trigger source (`cron | user | admin`).

User-side button shows toast based on returned outcome and relies on realtime channels for UI refresh.

## 4. dps_run_log table (new)
```text
id uuid pk
schedule_id uuid → savings_auto_save
user_id uuid
outcome text
reason text
amount numeric
triggered_by text  -- 'cron' | 'user' | 'admin'
created_at timestamptz default now()
```
RLS: users can `select` own rows; admins can `select` all; only service role inserts.

## 5. Automated end-to-end tests
Add Deno test `supabase/functions/process-auto-save/index.test.ts` (uses dotenv loader pattern, anon + service keys from `.env`).

Test scenarios (each creates its own throwaway user via service role, then cleans up):
1. **Successful collection** — seed wallet ৳500, schedule ৳100 daily with linked goal, `next_run_at = now()-1m`. Invoke EF. Assert: wallet -100, goal saved_amount +100, `savings_deposits` row inserted, `transactions` row inserted, `total_paid=1`, `last_run_at` set, `next_run_at` ≈ +1d, run_log outcome=`collected`, push function invoked (mock-asserted via `notifications` row).
2. **Insufficient balance / missed** — wallet ৳10, schedule ৳100. Assert `dps_missed_payments` row, `missed_count+1`, run_log=`missed`, notification row created.
3. **Idempotency** — invoke twice in a row. Second call returns `dedup>=1`, no double deduction, run_log=`dedup_skipped`.
4. **Plan completion** — schedule with `ends_at = now()-1s`. Assert `settled=true`, `is_active=false`, run_log=`settled`.
5. **Manual collect via `{schedule_id, force:true}`** as admin — bypasses dedup window, processes once.
6. **Realtime** — open a Postgres `LISTEN`/changes channel via supabase-js subscription before invoking; assert at least one event for `savings_auto_save` row update arrives within 5s (validates publication membership end-to-end).

Frontend smoke test (`vitest`, jsdom): render new admin panel with mocked supabase client returning canned schedules + run-log rows; assert columns, filter, and "Run now" calls `supabase.functions.invoke('process-auto-save', { body: { schedule_id, force: true } })`.

## Files touched
- New migration: create `dps_run_log` table + RLS + add to `supabase_realtime`.
- `supabase/functions/process-auto-save/index.ts` — body parsing, single-schedule mode, `force`, run-log writes, admin check.
- `src/components/admin/AdminAutoSaveMonitor.tsx` — redesigned dashboard.
- `src/components/SavingsFlow.tsx` — vertical timeline + "Collect Now" button.
- New `supabase/functions/process-auto-save/index.test.ts` — Deno e2e tests.
- New `src/components/admin/__tests__/AdminAutoSaveMonitor.test.tsx` — vitest smoke test.

No schema changes to existing DPS tables; only the new `dps_run_log` table and a publication add.
## Goal

Build a Cron Health admin page for the savings/DPS cron, add structured request logs, an on-demand backfill button with progress, automatic retries on 401/5xx, and a stall alert when `next_run_at` stops advancing for 24h.

There is already an `AdminAutoSaveMonitor` tab — we extend it rather than create a separate page so admins have one home for DPS health.

## What gets built

### 1. New table: `cron_invocation_log`

Append-only audit of every `process-auto-save` request (and any cron callers we add later).

Columns (besides id/created_at):
- `function_name` — e.g. `process-auto-save`
- `triggered_by` — `cron` | `user` | `admin`
- `auth_method` — `vault_secret` | `env_secret` | `bearer_user` | `bearer_admin` | `none`
- `status_code` — 200 / 401 / 4xx / 5xx
- `processed`, `skipped`, `settled`, `missed`, `dedup` — counters from the run
- `schedule_count` — total schedules considered
- `duration_ms`
- `error_code`, `error_message` — null on success
- `request_id` — incoming `x-request-id` or generated UUID
- `caller_ip` — best-effort

RLS: admin-only SELECT; service_role full access. Indexes on `(function_name, created_at desc)` and `(status_code, created_at desc)`.

### 2. Edge function changes (`process-auto-save`)

- Log a row into `cron_invocation_log` at end of every invocation (success and failure).
- Surface `auth_method` in the log: vault vs env-var vs user bearer vs admin bearer.
- Include `X-Request-Id` echo in response headers.
- Add a new mode `body.mode = "backfill"` (admin or cron only) that runs the schedule loop up to N=10 cycles for any plan whose `next_run_at` is more than 24h overdue, instead of one cycle. Returns per-schedule cycle counts.

### 3. New edge function: `cron-health-snapshot`

GET endpoint, admin-only. Returns a single JSON snapshot used by the UI:
- Per-schedule rows: `id`, `user_phone`, `frequency`, `next_run_at`, `last_run_at`, `is_active`, `settled`, `total_paid`, `total_installments`, `hours_since_advance`, `is_stalled` (true when `next_run_at < now() - 24h AND is_active`), `last_outcome` from `dps_run_log`.
- Function-level stats (last 24h / 7d): success count, 401 count, 5xx count, last successful run time, last error.
- Cron job entries from `cron.job` for `phase4-process-auto-save` and `phase4-dps-reminder` (active flag, schedule expression, last result from `cron.job_run_details`).

### 4. New edge function: `cron-stall-alert`

Runs every 6 hours via pg_cron. Detects active schedules where `next_run_at < now() - interval '24 hours' AND is_active`. For each new stall (not already alerted within 24h):
- Inserts a row into `admin_notifications` (already exists).
- Sends a transactional email to admin recipients via the existing transactional-email infra (template `cron-stall-alert`, scaffolded if not present).
- Optional webhook: if env `CRON_ALERT_WEBHOOK_URL` is set, POSTs a JSON payload `{ stalled: [...], detected_at }`.

A small `cron_alert_state` table tracks `(schedule_id, last_alerted_at)` to dedupe alerts.

### 5. Automatic retries on 401/5xx

Add a new pg_cron job `phase4-process-auto-save-retry` running every 5 minutes that checks `cron_invocation_log`: if the most recent `process-auto-save` row for `function_name='process-auto-save'` has `status_code IN (401, 500..599)` AND no successful row exists within the last 20 minutes, re-invoke `process-auto-save` (same vault-secret cron header).

Retry is capped: skipped if 3 consecutive retry rows already exist within the last hour.

### 6. UI — extend `AdminAutoSaveMonitor`

New segmented sub-tabs at the top: `Schedules`, `Health`, `Logs`.

- **Schedules** — keep existing table; add columns: `Hours since advance`, `Stalled badge` (red), `Backfill` row action.
- **Health**:
  - 4 stat cards: Last successful run (relative time), 401s last 24h, 5xx last 24h, Stalled schedules count.
  - Mini chart: success vs error counts per hour for last 24h (Recharts BarChart, reuses pattern from `AdminBankReconciliation`).
  - Cron job status panel: active flag, schedule expression, last cron.job_run_details row per job.
  - "Trigger backfill now" button (admin only): calls `process-auto-save` with `{ mode: "backfill", force: true }`. Shows in-flight spinner, then a result panel listing per-schedule outcome chips (collected / missed / settled / skipped) with cycle counts.
- **Logs**:
  - Filter: status (all / 200 / 401 / 5xx), triggered_by, date range (default 7d).
  - Paginated table from `cron_invocation_log`: timestamp, triggered_by, auth_method, status, counters, duration, error.
  - CSV export for the current filter.

Realtime: subscribe to `postgres_changes` on `cron_invocation_log` so the Logs tab and Health stats update without refresh (matches the project's zero-refresh policy).

### 7. Tests

- Vitest for the new `cron-health-snapshot` JSON shape (mock supabase client).
- Unit test that `process-auto-save` writes a log row with the correct `auth_method` for each auth path.
- Unit test for the stall detector (24h boundary).

## Out of scope

- Push notifications for admins (already covered by `admin_notifications` + existing center).
- Per-user UI for missed payments (already in SavingsPage).
- Retry policy beyond cron auth/transport failures — application-level retries (insufficient balance) stay as `missed` in `dps_missed_payments`.

## Files & surfaces

- New: `supabase/functions/cron-health-snapshot/index.ts`, `supabase/functions/cron-stall-alert/index.ts`
- Edited: `supabase/functions/process-auto-save/index.ts` (logging + backfill mode)
- Migration: `cron_invocation_log`, `cron_alert_state`, indexes, RLS, GRANTs, RPC `get_cron_health_snapshot()` (if we keep it DB-side instead of EF — TBD during impl, EF is preferred since it joins cron.* tables)
- Insert: schedule `phase4-process-auto-save-retry` (`*/5 * * * *`) and `phase4-cron-stall-alert` (`0 */6 * * *`)
- New UI: `src/components/admin/AdminCronHealthTab.tsx`, `src/components/admin/AdminCronLogsTab.tsx`, `src/components/admin/CronBackfillSheet.tsx`
- Edited UI: `src/components/admin/AdminAutoSaveMonitor.tsx` — wraps the three sub-tabs
- Optional: scaffold transactional email `cron-stall-alert` if the user wants email alerts (requires email domain — confirmed in checks before scaffolding).

## Open question (one)

Email alerts require an email domain set up via Lovable Emails. If it isn't configured yet, I'll default to the webhook path and inserting `admin_notifications` rows; you can add the email path later by setting up a sender domain. Want me to also kick off email setup as part of this build, or stick with webhook + in-app notifications for now?

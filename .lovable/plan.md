## Problem

The "Next 6/1/2026" and "Next 5/6/2026" dates you circled are **stale due-dates in the past** (today is June 11, 2026). Daily DPS plans should have advanced their `next_run_at` every day — but they haven't been processed since they were created.

## Root cause

The `process-auto-save` edge function runs on a `*/15 * * * *` cron job, but the cron job is being **rejected as Unauthorized** every time it fires.

The edge function accepts two auth modes:
1. **Cron mode** — requires header `x-cron-secret` matching `ADMIN_METRICS_CRON_SECRET`
2. **User mode** — requires a Bearer token whose JWT has a `sub` claim

The current cron job sends only `Authorization: Bearer <anon-key>` and **no `x-cron-secret`**. The function takes the "user" path, calls `auth.getClaims()` on the anon JWT, finds no `sub` claim, and returns `401 UNAUTHORIZED`.

Confirmation: DB shows `next_run_at` stuck at past dates (e.g. one daily plan from May 5 still at `2026-05-06`, total_paid=2 after 37 days). No "processed" logs from the function either — only boot/shutdown.

The same bug affects:
- DPS auto-collection (missed installments aren't recorded)
- Plan settlement when `ends_at` is reached
- "Next run" date display (always shows the original creation+1 day)

The "Collect now" button works because it's invoked by the logged-in user (valid Bearer token, valid `sub`).

## Fix

Update the cron job to send the `x-cron-secret` header so the function recognizes it as a cron invocation.

### Steps

1. **Verify the cron secret exists** — read `ADMIN_METRICS_CRON_SECRET` from edge function secrets. If unset or shorter than 16 chars, generate one and store it.
2. **Replace the `phase4-process-auto-save` cron job** so its `net.http_post` headers include:
   ```
   x-cron-secret: <ADMIN_METRICS_CRON_SECRET>
   ```
   (The Authorization Bearer can stay or be removed — `isCron` takes priority.)
3. **Also patch `phase4-dps-reminder`** if its function uses the same cron-secret pattern (will check while migrating).
4. **Backfill stale schedules**: manually invoke `process-auto-save` once with `force=true` (admin) so the three currently-overdue plans catch up and `next_run_at` moves to today/tomorrow. Without this, users will still see stale dates until the next natural cycle.
5. **Verify**: tail `process-auto-save` logs after the next 15-minute tick to confirm `processed`/`settled`/`missed` counters increment, and re-query `savings_auto_save` to confirm `next_run_at` is in the future.

### Files / surfaces touched

- One DB migration to recreate the two cron jobs with the `x-cron-secret` header. No app code changes.
- One manual edge-function call to backfill overdue schedules.

### Out of scope

- No UI changes — the dates render correctly once the backend advances `next_run_at`.
- No changes to `process-auto-save` auth logic (it's correct; the cron job was just calling it wrong).

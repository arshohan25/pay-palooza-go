## Goal
Admins can see every action a user performs — taps, screen views, QR opens, QR shares, transactions, logins — in a live feed and searchable history per user.

## What gets built

### 1. Database (1 migration)
- **`user_activity_logs`** table: `id, user_id, session_id, event_type, event_name, route, target` (e.g. button/link label), `metadata` (jsonb — amount, recipient, qr code, share channel, etc.), `device_fingerprint, user_agent, ip_address, created_at`
- Indexes on `(user_id, created_at desc)` and `(event_type, created_at desc)` for fast per-user lookups
- Realtime enabled (`ALTER PUBLICATION supabase_realtime ADD TABLE …`)
- RLS:
  - User can INSERT their own rows only (`auth.uid() = user_id`)
  - Only admins can SELECT (uses existing `has_role(auth.uid(),'admin')`)
- Auto-purge: daily `pg_cron` job deletes rows older than 90 days

### 2. Client tracker (`src/lib/activityTracker.ts`)
Small singleton that:
- Generates per-tab `session_id`
- Exposes `track(eventName, metadata?)`
- Captures automatically:
  - **Screen views** — listens to React Router location changes
  - **Taps** — global `pointerdown` listener; resolves nearest `<button>`, `<a>`, or `[data-track]` and records its accessible label
  - **QR events** — explicit `track('qr_opened')`, `track('qr_shared', { channel })`, `track('qr_scanned', { decoded })` inside `UserQrModal`, `DynamicQrPaySheet`, `WalletShareSheet`, `QrScannerModal`
  - **Transactions** — explicit calls inside Send / CashOut / AddMoney / Payment / BillPay / Recharge success handlers
  - **Auth** — login, logout, PIN success/fail
- Batches events (flush every 3s or 20 events) into a single insert to keep cost down
- Skips logging when no `auth.uid()` (no anonymous noise)

### 3. Mount the tracker once
- Initialize inside `AppLayout` so it runs for every authenticated route
- Tiny `useTrackRoute()` hook driven by `useLocation()`

### 4. Admin UI — new "Activity" tab in User Management drawer
- **Live feed** (top): subscribes to `postgres_changes` on `user_activity_logs` filtered by `user_id`, newest first, glassmorphism cards with icon per event type, relative timestamp
- **History** (below): paginated list with filters — event type, date range, search
- **Per-event detail**: expandable JSON view of `metadata`
- Global "Activity" section in `/admin` shows last 100 events across all users, auto-streaming

### Technical notes
- Tracker inserts via a `log_activity` RPC (`security definer`) that reads `x-forwarded-for` for real IP — avoids trusting client IP
- 90-day retention:
  ```sql
  select cron.schedule('purge-activity-logs','0 3 * * *',
    $$ delete from public.user_activity_logs where created_at < now() - interval '90 days' $$);
  ```
- Volume guard: client rate-limits to max 1 tap per element per 500ms; debounces rapid route changes
- Sensitive values (PIN, OTP, full card numbers) explicitly stripped from metadata

## Out of scope
- Keystroke / form-field capture (privacy + cost)
- Heatmaps / session replay video
- CSV export (can add later)

Approve to build, or tell me what to change.
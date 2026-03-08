

## Plan: Webhook Delivery Retry Logic

### Current State
The `merchant-payment-webhook` edge function fires once. If delivery fails (network error or non-2xx), it marks `webhook_delivered = false` and gives up. No retries.

### What We'll Build

**1. Add retry tracking columns** (DB migration)
- `webhook_attempts` (integer, default 0) — count of delivery attempts
- `webhook_next_retry_at` (timestamptz, nullable) — when to retry next

**2. Update `merchant-payment-webhook` edge function**
- Add exponential backoff retry logic within the function itself (up to 3 inline retries with 1s, 3s, 9s delays)
- On final failure, set `webhook_next_retry_at` for async retry pickup
- Track attempt count in `webhook_attempts`

**3. Create `retry-failed-webhooks` edge function**
- Queries sessions where `webhook_delivered = false AND webhook_attempts < 5 AND webhook_next_retry_at <= now() AND status IN ('completed','failed')`
- For each, calls the existing webhook delivery logic
- Uses exponential backoff schedule: retry at 1min, 5min, 30min, 2hr, 24hr
- On success: marks `webhook_delivered = true`
- On final failure (attempt 5): marks as permanently failed in metadata

**4. Schedule via pg_cron**
- Run `retry-failed-webhooks` every 1 minute to pick up pending retries

### Files

| File | Action |
|------|--------|
| DB migration | Add `webhook_attempts`, `webhook_next_retry_at` columns |
| `supabase/functions/merchant-payment-webhook/index.ts` | Update to track attempts + set next retry |
| `supabase/functions/retry-failed-webhooks/index.ts` | New — batch retry processor |
| `supabase/config.toml` | Add verify_jwt=false for new function |
| pg_cron (insert tool) | Schedule retry function every minute |


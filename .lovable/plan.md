

## All Three Features Already Exist — Only pg_cron Scheduling Is Missing

The SDK, analytics dashboard, and expiry function were all implemented in a previous session. The only gap is that **pg_cron** hasn't been configured to automatically invoke the expiry cleanup on a schedule.

### What's already done
- **SDK**: `public/sdk/easypay-sdk.js` — fully functional
- **Analytics**: `src/components/MerchantAnalyticsTab.tsx` — wired into Merchant Dashboard
- **Expiry function**: `supabase/functions/expire-payment-sessions/index.ts` + `expire_stale_payment_sessions()` DB function + piggyback cleanup in `merchant-payment-api`

### What needs to be added
**pg_cron job** to auto-invoke the expiry edge function every 3 minutes:

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule cleanup every 3 minutes
SELECT cron.schedule(
  'expire-payment-sessions',
  '*/3 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lmgsxyzytssddijjxbzc.supabase.co/functions/v1/expire-payment-sessions',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZ3N4eXp5dHNzZGRpamp4YnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTk2MTIsImV4cCI6MjA4NzA5NTYxMn0.E-IM5AMLYeN2DE64NoduoQXVG8DL57T43vjpZ21Ft74"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

This will be executed via the insert tool (not migration) since it contains project-specific secrets.

### Files
| File | Action |
|------|--------|
| Database (insert tool) | Add pg_cron schedule for session expiry |

No other code changes needed — everything else is already implemented and working.


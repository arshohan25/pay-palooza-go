## Phase 4 — Merchant + Agent/Distributor push & scheduled digests ✅

### Migration applied
`20260425_phase4_push_triggers.sql` (via migration tool) added:
- Shared helper `public._dispatch_push(uuid[], text, text, text)` — wraps `net.http_post` to `send-push-notification`, exception-safe.
- 7 new triggers (all also write to `notifications`):
  - `trg_notify_merchant_new_order` (orders INSERT)
  - `trg_notify_merchant_payout_paid` (merchant_payouts → paid/completed/credited)
  - `trg_notify_merchant_refund_request` (return_requests INSERT)
  - `trg_notify_merchant_low_stock` (merchant_products.stock crossing ≤5 from above)
  - `trg_notify_agent_float_low` (profiles.balance — agent users only, < 10% of max_float, crossing)
  - `trg_notify_commission_credited` (commission_logs INSERT — agent + distributor + master_distributor)
  - `trg_notify_fund_request_decision` (fund_requests → approved | rejected)

### Edge functions
- **NEW** `send-daily-summary` — aggregates yesterday's completed transactions per user, sends one rolled-up push per user. De-dupes via `category=daily_summary` per BDT day.
- **NEW** `send-wishlist-nudge` — finds wishlist items 24h–7d old, pushes one notification per user. 3-day cooldown.
- **EXTENDED** `dps-reminder` — now also dispatches web push alongside the existing in-app insert.

### Cron jobs (scheduled via `cron.schedule`, not migrations)
| Job | Schedule (UTC) | Local (BDT) |
|---|---|---|
| `phase4-daily-summary` | `0 14 * * *` | 8:00 PM |
| `phase4-wishlist-nudge` | `0 */6 * * *` | every 6h |
| `phase4-dps-reminder` | `0 3 * * *` | 9:00 AM |

### UI mounting
`PushOptInPrompt` already lives in `AppLayout` → surfaces on every authenticated route automatically. No per-dashboard mounting needed.

### Notes / known limitations
- **Low-stock threshold** is a flat `≤ 5` because `merchant_products` has no per-product `low_stock_threshold` column. If you want per-product, add the column and tweak the trigger.
- **Abandoned cart** became **wishlist nudge** because there's no `carts` table — the closest available signal is the `wishlists` table.
- **Agent float** is derived from `profiles.balance / agents.max_float` (no separate float-balance table exists).
- 4 pre-existing public-bucket linter warnings remain — unrelated to this phase.

### Verification
- New order on the shop → buyer + each affected merchant gets push.
- Admin marks payout `paid` → merchant gets push.
- Buyer files a return → all involved merchants get push.
- Stock drops to ≤5 → merchant gets push.
- Agent's wallet drops below 10% of max_float → agent gets push.
- New `commission_logs` row → agent / distributor / super-distributor get push.
- Admin approves or rejects fund request → user gets push.
- Cron jobs visible in Postgres `cron.job` table; first daily summary fires next 14:00 UTC.

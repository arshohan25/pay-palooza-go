

## Plan: Add Webhook Events Log to Admin Dashboard

### Overview
Create a new admin tab that displays all `payment_sessions` data as a webhook/IPN event log, showing timestamps, provider, status, amount, and full metadata payloads. This leverages existing data — the webhook already stores IPN payloads and verify results in the `metadata` JSONB column of `payment_sessions`, and audit logs capture credit events. No new database table needed.

### Changes

#### 1. New component: `src/components/admin/AdminWebhookLog.tsx`
- Fetches from `payment_sessions` table (ordered by `created_at DESC`, limit 100)
- Displays a table with columns: Time, Provider, Amount, Status, Session ID, Provider TxnID
- Each row is expandable to show full `metadata` JSONB (IPN payload, verify result, callback data) in a formatted JSON viewer
- Filter controls: provider dropdown (all/bkash/nagad/asthapay), status dropdown (all/pending/completed/failed)
- Also fetches related `audit_logs` where `action IN ('payment_credit_webhook', 'payment_credit_ipn')` to show credit confirmation alongside each session
- Color-coded status badges (green=completed, yellow=pending, red=failed)

#### 2. Edit: `src/pages/AdminDashboard.tsx`
- Add `{ id: "webhooks", label: "Webhooks", icon: Activity }` to `NAV_ITEMS` (using already-imported `Activity` icon)
- Import `AdminWebhookLog` component
- Add `{activeTab === "webhooks" && <AdminWebhookLog />}` in the tab content area

### Data source
The `payment_sessions` table already contains all webhook event data:
- `provider` — bkash/nagad/asthapay
- `status` — pending/completed/failed
- `metadata` — contains `callback_data`, `ipn_data`, `verify_result`, `callback_status`
- `provider_payment_id`, `provider_trx_id` — external references
- `created_at`, `completed_at` — timestamps

RLS already allows admin SELECT on `payment_sessions` via service role queries in edge functions, but the admin reads via the client. Need to check if admin SELECT policy exists... Looking at the schema: `payment_sessions` only has user-level policies. Will need a migration to add admin SELECT policy.

#### 3. Migration: Add admin SELECT policy on `payment_sessions`
```sql
CREATE POLICY "Admins can view all payment sessions"
  ON public.payment_sessions FOR SELECT
  USING (has_role(auth.uid(), 'admin'));
```

### Files
- **New**: `src/components/admin/AdminWebhookLog.tsx`
- **Edit**: `src/pages/AdminDashboard.tsx` — add nav item + tab content
- **Migration**: Add admin RLS policy on `payment_sessions`


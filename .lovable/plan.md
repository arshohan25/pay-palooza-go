

## Add Notification Alerts for Loan Status Changes & Insurance Expiry

### Summary
Create two database triggers that automatically insert rows into the existing `notifications` table — one fires when a loan application's status changes, and the other runs on a schedule to warn users about expiring insurance policies. The existing real-time notification system will pick these up automatically (no frontend changes needed).

### Changes

#### 1. Database Trigger — Loan Status Change
Create a trigger function `notify_loan_status_change()` on `loan_applications` that fires `AFTER UPDATE` when the `status` column changes. It inserts a notification with:
- **title**: e.g. "Loan Application Approved", "Loan Application Rejected"
- **body**: e.g. "Your loan of ৳10,000 has been approved. Disbursement will follow shortly."
- **category**: `loan`
- **metadata**: `{ loan_id, amount, status, notes }`

Status-specific messages:
- `approved` → "Your loan of ৳X has been approved!"
- `rejected` → "Your loan application for ৳X was not approved." (include notes if present)
- `disbursed` → "৳X has been disbursed to your wallet."
- `repaid` → "Your loan of ৳X is fully repaid. Thank you!"

#### 2. Database Trigger — Insurance Policy Expiry Warning
Create a function `notify_insurance_expiry()` that checks for active policies expiring within 7 days. This will be called via a **pg_cron** scheduled job (daily at 9 AM).

For each expiring policy, insert a notification:
- **title**: "Insurance Expiring Soon"
- **body**: "Your [plan_name] policy expires on [date]. Renew now to stay covered."
- **category**: `insurance`
- **metadata**: `{ policy_id, plan_name, expires_at }`

Uses a dedup check (no duplicate notification for the same policy within 7 days via metadata match).

#### 3. pg_cron Job for Insurance Expiry
Schedule a daily cron job that calls the `notify_insurance_expiry()` function.

### Files Modified
1. **Database migration** — two trigger functions + one trigger + one cron job insert

### No Frontend Changes Needed
The existing `useNotifications` hook already subscribes to real-time inserts on the `notifications` table, so new notifications will appear instantly in the bell icon and Notification Center without any code changes.


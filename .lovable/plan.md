# Notify merchants on "Get approved" step completion

When an admin approves (or rejects) a merchant's business KYC, send a push notification + email to the merchant so they immediately know the onboarding step has completed. Mirrors the existing pattern used for `notify-api-access-decision`.

## What gets built

### 1. New edge function: `notify-merchant-approval`
- Inputs: `{ user_id, merchant_id, status: 'approved' | 'rejected', reason?, business_name? }`
- Sends push via `send-push-notification` with `category: 'merchant_ops'`, deep-link `url: '/merchant'`.
- Sends email via the project's existing email path (same approach as `notify-api-access-decision` — Resend through the configured sender). Subject + body differ by status.
- Inserts a row into `notifications` table (so it also shows in the in-app bell), category `merchant`, link `/merchant`.
- Idempotent: skip if a notification with the same `(user_id, type='merchant_approval', merchant_id, status)` already exists in the last 10 min.

Approved copy:
- Title: "You're approved 🎉 — start selling"
- Body: "Your vendor account is live. Set your bank details and add products to go live on EasyPay Shop."

Rejected copy:
- Title: "Vendor application needs changes"
- Body: reason if provided, else "Please review the feedback in your Merchant dashboard and resubmit."

### 2. Migration: DB trigger on `merchants` + RPC patch
Add an `AFTER UPDATE` trigger on `public.merchants` that fires when `business_kyc_status` transitions from any value to `approved` or `rejected`. The trigger uses `pg_net.http_post` to invoke `notify-merchant-approval` with the merchant's `user_id`, `id`, new status, `business_kyc_rejection_reason`, and `business_name`.

This catches both the existing `approve_business_kyc` / `reject_business_kyc` RPC paths and any direct admin updates — no changes needed to the RPCs themselves.

Trigger guard: only fire when `OLD.business_kyc_status IS DISTINCT FROM NEW.business_kyc_status` AND `NEW.business_kyc_status IN ('approved','rejected')`.

### 3. Frontend: zero changes required
The existing `VendorOnboardingChecklist` already subscribes to `merchants` postgres_changes, so the UI flips to "done" in real time. The push/email is purely additive — it reaches the merchant when the app is closed.

## Push opt-in / preferences
- Reuses `send-push-notification` which already filters by `notification_preferences` for the given category.
- Category used: `merchant_ops` (existing category in the push system per memory `features/notifications/push`).
- If the merchant hasn't subscribed to push, only email + in-app notification deliver — graceful degradation.

## Files

New:
- `supabase/functions/notify-merchant-approval/index.ts`
- `supabase/migrations/<ts>_merchant_approval_notify_trigger.sql` — trigger + function using `pg_net` (URL + service-role auth pulled from vault, same pattern as existing notify triggers in this project).

No frontend changes.

## Out of scope
- No changes to the approve/reject RPCs.
- No new email template scaffolding — uses existing email sending path already used by `notify-api-access-decision` and `kyc-notify`.
- Bank-account / push-subscription step completions are not notified (those are self-initiated by the merchant; no need to alert them about their own action).

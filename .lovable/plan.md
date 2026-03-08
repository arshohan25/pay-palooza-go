

## Plan: Merchant SDK Widget, Session Expiry Cleanup, and Payment Analytics

### 1. Embeddable JavaScript SDK Widget

Create a standalone JS snippet that merchants can copy-paste into their websites. It renders a "Pay with EasyPay" button and handles the payment flow via iframe/redirect.

**New file: `public/sdk/easypay-sdk.js`**
- Self-contained IIFE script (no dependencies)
- Exposes `window.EasyPay` global with methods:
  - `EasyPay.init({ apiKey, apiEndpoint })` — configure merchant credentials
  - `EasyPay.createPayment({ amount, reference, description, successUrl, cancelUrl })` — calls merchant-payment-api, then redirects to checkout URL
  - `EasyPay.renderButton(containerSelector, paymentOptions)` — renders a styled "Pay with EasyPay" button in a target div
- Button opens checkout in a new tab/popup or redirect (configurable)
- Includes inline CSS for the button (branded EasyPay style)

**Update: `src/components/MerchantApiTab.tsx`**
- Add a new "SDK Widget" section in the Integration Guide showing:
  - Script tag: `<script src="https://pay-palooza-go.lovable.app/sdk/easypay-sdk.js"></script>`
  - Usage example with `EasyPay.init()` and `EasyPay.renderButton()`
  - Copy-to-clipboard for the full snippet

### 2. Session Expiry Cleanup (Database Trigger)

Since pg_cron is not available in Lovable Cloud, use a pragmatic approach: a database function + edge function for cleanup, and also expire on read.

**Database migration:**
- Create a function `expire_stale_payment_sessions()` that updates all `merchant_payment_sessions` where `status = 'pending'` and `expires_at < now()` to `status = 'expired'`
- Update the default `expires_at` from 30 minutes to 3 minutes: `DEFAULT (now() + interval '3 minutes')`

**New edge function: `supabase/functions/expire-payment-sessions/index.ts`**
- Calls the `expire_stale_payment_sessions()` function
- Can be invoked periodically via external cron or manually
- Also called at the start of `merchant-payment-api` on every request (piggyback cleanup)

**Update: `supabase/functions/merchant-payment-api/index.ts`**
- At the start of each request, run the expiry cleanup query inline (single UPDATE statement)
- This ensures stale sessions are expired on every API call

**Update: `src/pages/CheckoutPage.tsx`**
- Already checks expiry on load — no changes needed

### 3. Merchant Payment Analytics

**New component: `src/components/MerchantAnalyticsTab.tsx`**
- Queries `merchant_payment_sessions` for the current merchant
- Shows:
  - **Summary cards**: Total sessions, completed count, success rate %, total revenue
  - **Daily breakdown chart** (using recharts `BarChart`): sessions per day, colored by status (completed vs failed vs expired)
  - **Revenue line chart**: daily completed revenue over last 30 days
  - **Status distribution**: pie/donut chart showing pending/completed/failed/expired breakdown
- Date range filter (7d / 30d / 90d)

**Update: `src/pages/MerchantDashboard.tsx`**
- The "analytics" tab already exists in the tab type. Wire it to use `MerchantAnalyticsTab` for API payment analytics (or add a sub-section).

### Files Summary

| File | Action |
|------|--------|
| `public/sdk/easypay-sdk.js` | New — embeddable SDK |
| `src/components/MerchantApiTab.tsx` | Update — add SDK snippet docs |
| `src/components/MerchantAnalyticsTab.tsx` | New — analytics dashboard |
| `src/pages/MerchantDashboard.tsx` | Update — wire analytics tab |
| `supabase/functions/merchant-payment-api/index.ts` | Update — piggyback session expiry |
| `supabase/functions/expire-payment-sessions/index.ts` | New — standalone expiry function |
| Database migration | Change default expires_at to 3 min, add expiry function |


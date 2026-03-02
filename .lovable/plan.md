

## Plan: Integrate AsthaPay Payment Gateway

### Overview
Add AsthaPay as a payment option in the Add Money flow. Credentials will be managed via the existing admin gateway config panel (`payment_gateways` table), matching the bKash/Nagad pattern.

### 1. Seed AsthaPay into `payment_gateways` table
- SQL migration to insert a row: `provider = 'asthapay'`, `display_name = 'AsthaPay'`, `is_enabled = false`, `config = {}` (empty — admin fills in `API-KEY`, `SECRET-KEY`, `BRAND-KEY` later from the dashboard)

### 2. Create edge function `supabase/functions/asthapay-payment/index.ts`
Following the exact same pattern as `bkash-payment`:
- Read credentials from `payment_gateways` where `provider = 'asthapay'`
- **`action=create`**: POST to `https://pay.asthapay.com/api/payment/create` with headers `API-KEY`, `SECRET-KEY`, `BRAND-KEY`. Body: `amount`, `invoice_number`, `success_url`, `cancel_url`. Store session in `payment_sessions`. Return `payment_url` for redirect.
- **`action=verify`**: POST to `https://pay.asthapay.com/api/payment/verify` with `transaction_id`. If status is `COMPLETED`, credit user balance (idempotent), debit treasury via `treasury_debit_for_addmoney` RPC. Mark session complete.
- If credentials not configured, return `{ success: true, simulated: true }` (blocked by client).

### 3. Update `src/components/AddMoneyFlow.tsx`
- Add `asthapay` to `MFS_PROVIDERS` array with branding (purple/blue, "AsthaPay")
- In `handlePinConfirm`, add an `asthapay` branch alongside the existing bKash/Nagad block:
  - Call edge function with `action=create`
  - Block if `simulated` response (not configured)
  - Store pending session in `localStorage`
  - Redirect to `payment_url`

### 4. Update `src/pages/Index.tsx` — handle return redirect
- On mount, check URL query params for AsthaPay callback params (`transactionId`, `status`)
- Also check `localStorage` for `pending_payment_session` with provider `asthapay`
- If found, call edge function with `action=verify`
- On success, show Add Money success state + toast

### 5. Config
- Add `[functions.asthapay-payment]` with `verify_jwt = false` to `supabase/config.toml`

### Files
- **New**: `supabase/functions/asthapay-payment/index.ts`
- **Edit**: `src/components/AddMoneyFlow.tsx`
- **Edit**: `src/pages/Index.tsx`
- **Migration**: Insert `asthapay` row into `payment_gateways`


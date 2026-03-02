

## Plan: Integrate AsthaPay Payment Gateway

### Understanding the API
AsthaPay uses a redirect-based payment flow:
1. **Create Payment** → POST to `https://pay.asthapay.com/api/payment/create` with headers `API-KEY`, `SECRET-KEY`, `BRAND-KEY`
2. Returns a `payment_url` → redirect user to complete payment
3. User redirected back to `success_url` with query params (`transactionId`, `status`, etc.)
4. **Verify Payment** → POST to `https://pay.asthapay.com/api/payment/verify` with `transaction_id`

### Credentials Needed
AsthaPay requires 3 headers: **API-KEY**, **SECRET-KEY**, and **BRAND-KEY**. You provided a "Device key" (`9PbxJ7qYDGCOljYYFmMdyrzkd7fEyLEowZ0EFrpD`) — I'll need to confirm which credential this maps to, and collect the remaining two. All three will be stored as backend secrets.

### Changes

**1. Store secrets (3 keys)**
- `ASTHAPAY_API_KEY`
- `ASTHAPAY_SECRET_KEY`  
- `ASTHAPAY_BRAND_KEY`

**2. Create edge function `supabase/functions/asthapay-payment/index.ts`**
- `action=create`: Accepts amount + user info, calls AsthaPay create endpoint, stores a `payment_sessions` record, returns the `payment_url`
- `action=verify`: Accepts `transaction_id`, calls AsthaPay verify endpoint, if `COMPLETED` → credits user balance via `record_transaction` RPC + treasury debit, marks session complete

**3. Update `src/components/AddMoneyFlow.tsx`**
- Add "AsthaPay" as a new MFS provider entry with its own branding
- In `handlePinConfirm`, add an `asthapay` branch similar to the existing bKash/Nagad flow:
  - Call the edge function to create payment
  - Redirect user to `payment_url`
  - Store pending session in localStorage

**4. Add callback handler in `src/pages/Index.tsx`**
- On mount, check URL query params for `transactionId` + `status` (AsthaPay redirects back with these)
- If found, call the verify edge function
- On success, show the Add Money success state with confetti

### Files to create/modify
- **New**: `supabase/functions/asthapay-payment/index.ts`
- **Edit**: `src/components/AddMoneyFlow.tsx` — add AsthaPay provider + payment branch
- **Edit**: `src/pages/Index.tsx` — handle return redirect verification


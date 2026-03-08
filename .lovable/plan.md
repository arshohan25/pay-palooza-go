

## Plan: Fix Merchant Payment Gateway Issues for End-to-End Testing

After inspecting the full implementation, I found several issues that need fixing before the merchant payment gateway works end-to-end.

### Issues Found

1. **Missing `config.toml` entries**: `merchant-payment-api` and `merchant-payment-webhook` are not registered with `verify_jwt = false`. Currently they work because they were manually deployed, but this should be fixed for consistency.

2. **Missing UPDATE RLS policy on `merchant_payment_sessions`**: The checkout page (`CheckoutPage.tsx`) tries to update the session status after payment, but only admins have UPDATE access. Authenticated payers need an UPDATE policy scoped to their session.

3. **Missing CORS headers**: The edge functions use a limited `Access-Control-Allow-Headers` that's missing Supabase client headers (`x-supabase-client-platform`, etc.).

4. **Checkout page update fails silently**: After `transfer_money` succeeds, the session update at line 125-134 will fail due to RLS (no UPDATE policy for authenticated users). This means sessions stay "pending" even after successful payment.

### Fixes

#### 1. Database Migration
Add UPDATE policy on `merchant_payment_sessions` for authenticated users who are the payer:
```sql
CREATE POLICY "Payers can update their payment session"
ON merchant_payment_sessions FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);
```
Scoped more tightly: only allow updates where `payer_user_id IS NULL` (first update) or `payer_user_id = auth.uid()`.

#### 2. `supabase/config.toml`
Add missing function entries:
```toml
[functions.merchant-payment-api]
verify_jwt = false

[functions.merchant-payment-webhook]
verify_jwt = false
```

#### 3. Update CORS headers in both edge functions
Add the full set of required Supabase client headers.

#### 4. Redeploy edge functions
Deploy `merchant-payment-api` and `merchant-payment-webhook` after fixes.

### Files Modified
- `supabase/config.toml` — add 2 function entries
- `supabase/functions/merchant-payment-api/index.ts` — fix CORS headers
- `supabase/functions/merchant-payment-webhook/index.ts` — fix CORS headers
- Database migration — add UPDATE policy for payment sessions


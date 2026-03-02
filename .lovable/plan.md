

## Plan: Add AsthaPay IPN Webhook to `payment-webhook` Edge Function

### Problem
Currently, AsthaPay payment confirmation relies solely on client-side verify calls. If the user closes their browser after paying, the balance is never credited. A server-to-server IPN (Instant Payment Notification) callback ensures payments are always processed.

### Approach
Add an `asthapay` handler to the existing `payment-webhook` edge function (which already handles bKash and Nagad callbacks). This follows the exact same pattern as `handleNagadCallback` — no new edge function needed.

### Changes

#### 1. Edit `supabase/functions/payment-webhook/index.ts`
- Add `if (provider === "asthapay")` routing to the main handler (lines 84-95)
- Add `handleAsthapayIPN()` function that:
  - Accepts POST from AsthaPay with JSON body containing `transaction_id`, `invoice_number`, `status`, `amount`
  - Looks up the `payment_sessions` row by `provider_payment_id` or invoice number in metadata
  - Validates the IPN by calling AsthaPay's verify API using credentials from `payment_gateways` table (reusing the same `getCredentials` pattern from `asthapay-payment`)
  - Uses the idempotency gate: `UPDATE ... WHERE status = 'pending'` before crediting
  - Credits user balance via `creditUserBalance()` (already defined in the file)
  - Debits treasury via `treasury_debit_for_addmoney` RPC
  - Inserts audit log
  - Returns `200 OK` to AsthaPay (no redirect — server-to-server)

#### 2. Update `supabase/functions/asthapay-payment/index.ts`
- In the `create` action, set the IPN/webhook URL as part of the AsthaPay create payload:
  ```
  ipn_url: `${SUPABASE_URL}/functions/v1/payment-webhook?provider=asthapay`
  ```
  This tells AsthaPay where to send server-side notifications.

### No database or config changes needed
- `payment-webhook` already has `verify_jwt = false` in `config.toml` (required for public webhooks)
- The `creditUserBalance` helper and idempotency pattern are already in the file

### IPN flow
```text
AsthaPay Server ──POST──▶ /functions/v1/payment-webhook?provider=asthapay
                           │
                           ├─ Parse JSON body (transaction_id, invoice_number, status)
                           ├─ Find payment_session by provider_payment_id or invoice
                           ├─ Verify with AsthaPay API (server-to-server)
                           ├─ Idempotency gate: UPDATE WHERE status='pending'
                           ├─ creditUserBalance()
                           ├─ treasury_debit_for_addmoney()
                           ├─ audit_logs insert
                           └─ Return 200 { success: true }
```


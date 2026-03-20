

## Guest Payment via Link (No Login Required)

### Problem
The `/pay` page currently blocks unauthenticated users with a "Log In to Pay" screen. The user wants anyone with the payment link to pay directly using their phone number + OTP + PIN — no login/signup required.

### Architecture

The existing `checkout-pay` edge function already supports phone + OTP + PIN payment (no auth session), but requires a `merchant_payment_sessions` record. The `/pay` page currently only has a merchant code (e.g. `MRC-RAFIQ-001`), not a session ID.

```text
Guest Payment Flow:
┌─────────────┐    ┌──────────────────┐    ┌─────────────┐    ┌────────────┐
│ Payment Link │───▶│ Enter Phone      │───▶│ Enter OTP   │───▶│ Enter PIN  │
│ Summary      │    │ + Request OTP    │    │ (6 digits)  │    │ (4 digits) │
└─────────────┘    └──────────────────┘    └─────────────┘    └────────────┘
                          │                       │                  │
                   send-otp function        (client-side)    checkout-guest
                                                              edge function
```

### Changes

**1. New Edge Function: `supabase/functions/checkout-guest/index.ts`**
- Accepts: `merchant_code`, `amount`, `phone`, `otp_code`, `pin`, `note`, `ref`
- Resolves merchant from code via the merchants table (matching `merchant_id` field)
- Verifies OTP from `otp_codes` table
- Verifies PIN via `signInWithPassword`
- Checks payer balance, executes wallet-to-wallet transfer
- Records transactions for both payer and merchant
- No auth required (uses service role key server-side)

**2. New Component: `src/components/GuestCheckoutFlow.tsx`**
- Multi-step form: Phone → OTP → PIN → Processing → Success/Error
- Step 1: Shows payment summary (merchant, amount, ref), phone input, "Send OTP" button
- Step 2: 6-digit OTP input with resend timer
- Step 3: 4-digit PIN input
- Calls `send-otp` with purpose `"payment"`, then `checkout-guest` to complete
- Success screen with receipt details

**3. Update: `src/pages/PayPage.tsx`**
- Remove the login-required gate for unauthenticated users
- When `!user`: show the choice screen with two options:
  - "Pay as Guest" → renders `GuestCheckoutFlow` (phone + OTP + PIN)
  - "Log In to Pay" → existing redirect to auth page
- When `user`: existing flow unchanged (QR / Manual with PaymentFlow)

**4. Config: `supabase/config.toml`** 
- Add `[functions.checkout-guest]` with `verify_jwt = false`

### Security
- OTP verification prevents unauthorized payments
- PIN verification via Supabase Auth ensures only the account holder can pay
- Rate limiting on OTP requests (existing: 5/hour)
- Service role key used server-side only, never exposed to client


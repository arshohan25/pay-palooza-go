

## Plan: Premium OTP + PIN Confirmation Step

### Flow Change
```text
Current:  Phone → OTP (auto-submits → processing → success)
New:      Phone → OTP → PIN (4-digit) → Processing → Success
```

### Changes

**1. `src/pages/CheckoutPage.tsx`**

- Add `"pin"` to the `Step` type
- Add `pin` state variable
- **Redesign OTP input**: Premium glassmorphism style with larger slots, gradient borders on active/filled states, subtle glow effect, smooth scale animations on digit entry
- **After OTP completes 6 digits**: Instead of auto-calling `handleVerifyAndPay`, transition directly to `"pin"` step (no loading/processing in between — instant transition)
- **New PIN step UI**: Minimal card with 4-dot PIN input (masked with dots), "Enter your PIN to confirm" heading, amount pill at top. Uses the same premium input style
- **PIN submit**: Calls `checkout-pay` with `session_id`, `phone`, `otp_code`, and `pin`
- Remove the auto-submit on OTP completion that triggers payment; instead it transitions to PIN step

**2. `supabase/functions/checkout-pay/index.ts`**

- Accept additional `pin` field in request body
- After OTP verification and payer lookup, verify PIN by checking against Supabase Auth: sign in with `{phone}@easypay.local` and password `{pin}EP`
- If PIN auth fails, return error "Incorrect PIN"
- If PIN passes, proceed with transfer as before

### Files Changed
1. `src/pages/CheckoutPage.tsx` — Add PIN step, redesign OTP, remove auto-pay on OTP complete
2. `supabase/functions/checkout-pay/index.ts` — Add PIN verification via auth sign-in


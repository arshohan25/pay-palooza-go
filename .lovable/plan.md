

## Plan: OTP-Based Payment Checkout Redesign

### Overview
Replace the current PIN-based login + slide-to-confirm flow with a real-time OTP verification flow. Redesign the UI into a minimal, modern card layout. After successful payment, redirect to the merchant page with a 5-second visible countdown.

### Flow Change
```text
Current:  Login (phone+PIN) → Confirm (slide-to-pay) → Processing → Success
New:      Phone Entry → OTP Sent → OTP Verify → Processing → Success (5s countdown redirect)
```

### Changes to `src/pages/CheckoutPage.tsx`

**1. New step type:**
```
"loading" | "expired" | "error" | "phone" | "otp" | "processing" | "success" | "failed"
```

**2. Phone Entry Step (replaces "login"):**
- Single minimal card with merchant info + amount at top
- Phone input WITHOUT country code prefix (just `01XXXXXXXXX` placeholder)
- Clean, borderless input field with modern styling
- "Send OTP" button triggers `send-otp` edge function with `purpose: "payment"`

**3. OTP Verification Step (new, replaces "confirm"):**
- 6-digit OTP input using animated dot/box UI
- Resend OTP timer (60s cooldown)
- Auto-submit when all 6 digits entered
- Verify OTP against `otp_codes` table, then authenticate with PIN-less approach:
  - Actually: after OTP is verified, call `signIn(phone, pin)` is no longer needed. Instead, verify OTP server-side, then execute payment via a new edge function or modify existing flow.
  - Simpler approach: Keep phone+PIN login on submit of OTP. User enters phone → gets OTP → enters OTP to prove phone ownership → we authenticate them using their phone (the OTP replaces PIN as the auth factor for checkout).

**Wait — re-evaluation:** The existing auth system uses phone+PIN (Supabase password auth). We can't authenticate without the PIN. Better approach:

- Phone step: user enters phone number  
- Send OTP to that phone via `send-otp` edge function  
- OTP step: user enters 6-digit OTP  
- Verify OTP server-side, then on success, ask for PIN (brief step) OR combine: after OTP verify, execute payment server-side using service role (since OTP proves identity)

**Chosen approach:** OTP verification replaces PIN. After OTP is verified, execute payment server-side via a new edge function `checkout-pay` that:
1. Verifies the OTP code against `otp_codes` table
2. Looks up the user by phone
3. Executes the transfer using service role
4. Updates session status

**4. Success Step with 5-second countdown:**
- Display countdown from 5 to 0 with visible numbers
- Auto-redirect to `success_url` or merchant dashboard
- If no success_url, redirect to home `/`

**5. UI Redesign — Minimal Card:**
- Remove the `🇧🇩 +88` prefix from phone input
- Clean floating card design with subtle shadows
- Smooth input fields with rounded-2xl, no heavy borders
- Smaller, tighter spacing
- Modern font weights and micro-animations

### New Edge Function: `supabase/functions/checkout-pay/index.ts`
- Accepts: `{ session_id, phone, otp_code }`
- Verifies OTP from `otp_codes` table (not expired, not used)
- Marks OTP as verified
- Looks up payer profile by phone
- Looks up merchant from session
- Executes balance transfer (debit payer, credit merchant)
- Records transactions for both parties
- Updates session to `completed`
- Calls merchant webhook
- Returns success/error

### Update `send-otp` Edge Function
- Add `"payment"` as a valid purpose (currently only handles `"pin_reset"`)
- Skip the "phone must be registered" check for payment purpose (payer just needs an active account)

### Database Migration
- No schema changes needed — `otp_codes` table already supports arbitrary `purpose` values

### Files Changed
1. **`src/pages/CheckoutPage.tsx`** — Full rewrite of flow and UI
2. **`supabase/functions/checkout-pay/index.ts`** — New edge function for OTP-verified payment
3. **`supabase/functions/send-otp/index.ts`** — Allow `"payment"` purpose
4. **`supabase/config.toml`** — Register new edge function with `verify_jwt = false`


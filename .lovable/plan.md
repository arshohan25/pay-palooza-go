

## Fix Registration: Default OTP + Password Length Error

### Problem
1. **No SMS provider** — users can't receive OTP codes, so registration is stuck
2. **"Password should be at least 6 characters"** — Supabase Auth rejects the signup. The `pinToPassword` function pads PIN with "EP" (e.g., `1234` → `1234EP` = 6 chars), but the backend's minimum password length may be configured higher than 6, or there's a mismatch

### Changes

**1. `src/pages/AuthPage.tsx` — Restore hardcoded OTP "123456" (silent)**

- In `handleRegisterPhone`: skip calling the `send-otp` edge function. Go directly to `register_otp` step
- In `handleRegisterOtp`: instead of calling `verify-otp` edge function, simply check if the entered code equals `"123456"`. No hint displayed to the user — they need to know the default code
- Keep the forgot-PIN OTP flow unchanged (it already uses edge functions)

**2. Fix password length error — configure auth minimum password length**

- Use `cloud--configure_auth` to set the minimum password length to 6 (matching `pinToPassword` output: 4-digit PIN + "EP" = 6 chars)
- If that's not possible, change `pinToPassword` padding from `"EP"` to `"EPAY"` (8 chars) to safely exceed any reasonable minimum, and update `verifyPin.ts` and `ChangePinFlow.tsx` which also use `pinToPassword`

**3. Files affected:**
- `src/pages/AuthPage.tsx` — revert OTP to hardcoded "123456" check, remove edge function calls for registration OTP
- Auth config — lower minimum password length to 6


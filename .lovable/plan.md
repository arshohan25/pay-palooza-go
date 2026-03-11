

## Remove All Mock/Static Data

### Summary
Remove hardcoded demo data from the app: the fake OTP, the demo mode hints, fallback promo banners, the unused PromoCard component, and make registration use the real server-side OTP flow (same as forgot-PIN already does).

### Changes

**1. `src/pages/AuthPage.tsx` — Replace DEMO_OTP with real OTP verification**

- Delete `const DEMO_OTP = "123456"`
- Update `handleRegisterPhone` to call the `send-otp` edge function (with `purpose: "registration"`) before navigating to `register_otp`, just like `handleForgotSendOtp` does
- Update `handleRegisterOtp` to store the entered OTP and verify it server-side against `otp_codes` table (via the `send-otp` function's stored codes) instead of comparing to `DEMO_OTP`
- Remove the "Demo mode — use OTP 123456" hint box from the OTP screen UI (both register and forgot flows)
- Remove `serverOtp` state and the `demoMode` translation usage
- Remove `demoMode` translation keys from the `T` object (en + bn)

**2. `supabase/functions/send-otp/index.ts` — Support registration purpose**

- Allow `purpose: "registration"` (currently only "pin_reset" and "payment" check for registered phone — registration should skip that check since the user isn't registered yet)
- Remove `dev_otp: code` from the response (production cleanup)

**3. `src/components/PromoSlider.tsx` — Remove fallback banners**

- Delete `FALLBACK_BANNERS` array
- When no DB banners exist, show nothing (empty state) instead of hardcoded banners

**4. `src/components/PromoCard.tsx` — Delete file**

- Unused component with hardcoded promo content

**5. `src/lib/i18n.tsx` — Remove PromoCard translations**

- Remove `limitedOffer`, `promoCashback`, `promoValid` translation keys

**6. `src/components/OnboardingSlides.tsx` — Remove static slide data**

- Remove the hardcoded `SLIDES` array content
- Either fetch slides from DB or remove the onboarding feature entirely (slides are purely presentational marketing content)

### OTP Verification Approach

For registration OTP verification, we'll create a new edge function `verify-otp` (or add verification to `send-otp`) that checks the entered code against the `otp_codes` table, similar to how `reset-pin` and `checkout-pay` already do it. This keeps the pattern consistent.


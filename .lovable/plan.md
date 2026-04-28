# Mask saved phone & add Forgot PIN support flow

## What's changing

After a merchant successfully verifies their device the first time, the next visit to `/merchant-login` will:
1. Show the saved phone in masked form `019••••••954` instead of pre-filling the editable input.
2. Offer a one-tap "Use a different number" link to clear the binding and type fresh.
3. Show a clean **"Forgot PIN?"** link directly under the PIN field that opens an inline support form. Submitting the form creates a ticket our support team handles to reset the merchant's PIN.

## UX flow

**Returning device (phone bound):**
```text
┌──────────────────────────────┐
│  Welcome back                │
│                              │
│  Signed in as                │
│  📱 +880 019••••••954    [×] │   ← × clears binding
│                              │
│  ┌──┬──┬──┬──┐               │
│  │  │  │  │  │   4-digit PIN │
│  └──┴──┴──┴──┘               │
│                              │
│  Forgot PIN?                 │   ← opens support sheet
│                              │
│  [ Sign in to dashboard → ]  │
└──────────────────────────────┘
```

**Forgot PIN sheet (bottom drawer):**
- Title: "Reset your merchant PIN"
- Subtext explains support will call/SMS to verify identity within ~15 minutes during business hours.
- Pre-filled phone (the bound phone, masked & read-only — they can override).
- Optional message field ("Anything we should know?")
- Submit → toast "Request sent. Our team will contact you on +880 019••••••954." and closes the sheet.

## Files & scope

### Frontend
- **`src/pages/MerchantLoginPage.tsx`**
  - Add `maskPhone(phone)` helper → `019••••••954` (first 3 + 6 dots + last 3 of the 11-digit BD number).
  - When `mfs_device_phone` is in localStorage, render a **masked identity chip** instead of the editable phone input. Keep the cleaned phone in state so `handleSignIn` continues to work.
  - "Use a different number" (×) button: `localStorage.removeItem("mfs_device_phone")`, clear stored device token for that phone via `clearDeviceToken`, reset state, show the editable input.
  - Add **"Forgot PIN?"** text button under the PIN field (right-aligned, amber-100/70 hover).
  - New `<MerchantForgotPinSheet>` component (Sheet from `@/components/ui/sheet`, side="bottom", glass styling matching login card) opened by that button.
- **`src/pages/MerchantManagerLoginPage.tsx`** — same Forgot PIN button + sheet (no phone masking here since managers don't auto-bind).
- **`src/components/merchant/MerchantForgotPinSheet.tsx`** (new) — small form with phone (BD validated), optional note, submit button. Calls the edge function below. Reuses warm orange/rose login palette.

### Backend
- **New edge function `supabase/functions/merchant-forgot-pin/index.ts`** (public, no JWT)
  - Validates BD phone, optional note ≤ 500 chars, simple per-IP rate limit (max 3/hour).
  - Inserts a row into `support_complaints` (or whichever existing tickets table is appropriate — function will introspect once and we'll insert: `phone`, `subject = "Merchant PIN reset"`, `body`, `source = "merchant-login-forgot-pin"`, `status = "open"`, `priority = "high"`).
  - Service-role insert so the unauthenticated client never touches the table directly.
  - Returns `{ ok: true, masked_phone }`.
- No DB migration needed if `support_complaints` already accepts these columns; otherwise we'll add a tiny migration adding `source TEXT` + `phone TEXT` nullable columns.

### Memory
- Append a note under "Auth System" memories: returning merchants see masked phone; "Forgot PIN" routes to a public support intake (not the customer SMS reset flow).

## Technical notes

- Mask is purely display: stored value remains the full cleaned phone so the existing `callMerchantLogin` path is unchanged.
- The edge function uses `SERVICE_ROLE` and is added to `supabase/config.toml` only if a non-default config is needed (default `verify_jwt = false` in this project is fine).
- No changes to the merchant-login function or device-trust logic.
- Rate-limit table reuse: piggy-back on existing `merchant_login_attempts` (insert with `success = false`, `phone = "forgot:<ip>"`) to keep things schema-light, OR check last hour by IP via the same table. We'll pick the cleanest available helper after a quick read on the actual `support_complaints` schema.

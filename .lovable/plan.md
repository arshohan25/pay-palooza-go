## Goals

1. Hide the decorative "trust pills" + "perks row" once the device is verified — on **both** merchant and manager login pages.
2. Replace the full-width premium "Forgot PIN? Reset securely" pill with a **smaller, more aesthetic** inline button (still on-brand).
3. Add an **OTP verification gate** before the Forgot PIN sheet lets the user submit anything. After OTP auto-verifies, the user is **redirected to live support chat**, pre-loaded with a PIN-reset context, where the agent completes the reset.

---

## 1. Hide unnecessary blocks once device is verified

### Merchant owner page (`src/pages/MerchantLoginPage.tsx`)
Already has `{!boundPhone && (…)}` around the `Secure PIN / Encrypted / Bank-grade` pills and the `Orders / Payouts / QR / Insights` row (lines 628–661). No change needed — confirmed.

### Manager page (`src/pages/MerchantManagerLoginPage.tsx`)
Currently always shows the trust pills (lines 492–505). Add an equivalent gate. Managers don't bind a phone to the device, so use the existing `mfs_has_authenticated` localStorage flag (set on first successful sign-in across the project) as the "device is verified for this user" signal.

```ts
const [hasAuthedBefore, setHasAuthedBefore] = useState(false);
useEffect(() => {
  try { setHasAuthedBefore(localStorage.getItem("mfs_has_authenticated") === "1"); } catch {}
}, []);
```
Wrap the trust-pill grid with `{!hasAuthedBefore && ( … )}`.

Also remove the manager-only blue "Use your own phone & PIN / Sign up first" explainer (lines 371–389) when `hasAuthedBefore` is true — same reason: returning users don't need it.

---

## 2. Smaller, more aesthetic Forgot PIN button

Replace the current full-width premium pill (h-11, gradient bg, shimmer) with a compact glass chip that stays high-contrast but doesn't dominate the footer. Same component on both pages, themed amber vs sky.

```tsx
<button
  type="button"
  onClick={() => setForgotOpen(true)}
  className="group inline-flex items-center gap-1.5 rounded-full border border-amber-200/30 bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-medium text-amber-100/90 backdrop-blur-md transition-all hover:border-amber-200/60 hover:bg-amber-300/[0.08] hover:text-amber-50"
>
  <KeyRound className="h-3 w-3" />
  Forgot PIN?
  <span className="text-amber-200/70 group-hover:text-amber-100">Reset securely</span>
  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
</button>
```
- Removes the shimmer animation block and the wrapping `h-11 w-full` pill.
- Sits as a chip above the existing "Apply / Owner login / Sign up" footer links.
- Manager variant uses sky/indigo tokens.
- Keep the `shimmer` keyframe in `src/index.css` (cheap, may be reused).

---

## 3. OTP gate before live-support handoff

Update `src/components/merchant/MerchantForgotPinSheet.tsx` to be a 3-step wizard inside the existing bottom sheet:

```text
┌────────────────────────────┐    ┌──────────────────────────┐    ┌────────────────────────────┐
│ Step 1: phone (+ note)     │ →  │ Step 2: 6-digit OTP      │ →  │ Step 3: redirect to live   │
│ "Send verification code"   │    │ auto-submits at 6 digits │    │ support chat (PIN reset)   │
└────────────────────────────┘    └──────────────────────────┘    └────────────────────────────┘
```

### Step 1 — request code
- Replace the current direct `merchant-forgot-pin` invoke with a call to `supabase.functions.invoke("send-otp", { body: { phone: cleaned, purpose: "merchant_pin_reset" } })`.
- Validate the BD phone first (existing regex).
- On success → move to step 2 and start a 60s resend countdown.

### Step 2 — verify code
- Reuse the existing `<DeviceOtpStep />` component for visual consistency (it already supports `phone`, `resendIn`, `loading`, `error`, `devOtp`, `onVerify`, `onResend`, `onCancel` and auto-submits at 6 digits).
- `onVerify(code)` calls `supabase.functions.invoke("verify-otp", { body: { phone, code, purpose: "merchant_pin_reset" } })`.
- On `verified: true`:
  1. Still POST to `merchant-forgot-pin` (server-side: log a verified ticket — see §4 below) so support can see the request and trust it's identity-checked.
  2. Move to step 3.
- On error: clear the code, surface the error, allow resend after 60s.

### Step 3 — redirect to live chat for completion
Because the merchant is **not signed in** when they're at `/merchant-login`, the existing live-chat at `/account?openChat=1` would punt them to `/auth`. Two options:

- **Recommended (default):** route through `/auth` first and pass the chat-prefill via query string. Once the user signs in (or signs up — they can use a known mobile recharge / shop wallet), they land on `/account?openChat=1&prefill=…&contextTitle=…&contextBody=…` and `AccountPage` opens the support tab automatically (existing logic at lines 175–200).

  ```ts
  const prefill = encodeURIComponent(
    `Hi, I forgot my Merchant PIN for +88 ${maskBdPhone(phone)}. ` +
    `Identity verified via OTP at ${new Date().toLocaleString()}. ` +
    `Ticket ref: ${ticketRef}. Please complete my PIN reset.`
  );
  const ctxTitle = encodeURIComponent("Merchant PIN reset (OTP verified)");
  const ctxBody = encodeURIComponent(`Phone: +88 ${maskBdPhone(phone)} · Source: ${source}`);
  navigate(`/account?openChat=1&prefill=${prefill}&contextTitle=${ctxTitle}&contextBody=${ctxBody}`);
  ```

- **Fallback:** if the user dismisses the redirect, the verified ticket already sits in `merchant_pin_reset_requests` — support will still call them.

Show a final success card in step 3 with: a green check, "Identity verified", a CTA "Open live support to finish reset →", and a secondary "I'll wait for a callback" close button.

---

## 4. Edge function & DB tweaks

### `supabase/functions/merchant-forgot-pin/index.ts`
- Accept new optional fields `otp_verified: boolean` and `verified_at: string` in the body.
- Trust them only when an `otp_ticket` (HMAC-signed JWT-like token, same scheme as `verify-otp` already mints for `device_verify_*`) is also passed and validates server-side.
- If verified, mark the inserted row's `note` prefix with `[OTP-VERIFIED]` (no schema change needed) so admins see it in the queue.

### `supabase/functions/verify-otp/index.ts`
- Already mints an `otp_ticket` only for purposes starting with `device_verify_`. **Extend** the condition so `merchant_pin_reset` also mints a single-use ticket (2-min TTL). The merchant-forgot-pin function will validate it with the same HMAC/secret.

### `supabase/functions/send-otp/index.ts`
- No code change expected; the existing function should already accept arbitrary `purpose` strings. (Will verify when implementing.)

No SQL migration required — `merchant_pin_reset_requests` already has `note`, `phone`, `source`, etc.

---

## 5. Files to edit

- `src/pages/MerchantLoginPage.tsx` — shrink Forgot PIN button.
- `src/pages/MerchantManagerLoginPage.tsx` — gate trust pills + manager explainer behind `mfs_has_authenticated`; shrink Forgot PIN button.
- `src/components/merchant/MerchantForgotPinSheet.tsx` — convert to 3-step wizard (phone → OTP → live-chat handoff). Reuse `<DeviceOtpStep />`.
- `supabase/functions/verify-otp/index.ts` — also mint OTP ticket for `merchant_pin_reset` purpose.
- `supabase/functions/merchant-forgot-pin/index.ts` — validate optional OTP ticket and mark request as identity-verified.

---

## Open question (will assume default unless you say otherwise)

The live-support chat lives inside `/account`, which requires the user to be signed in. The plan routes verified users through `/auth?redirect=/account?openChat=1&…` so they land in chat after signing in. If you'd prefer a **public** live-chat endpoint (no auth required) for forgot-PIN cases, say so and I'll add a lightweight unauthenticated chat surface instead.

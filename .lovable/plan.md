# Device-Bound First-Login OTP Across All Portals

Add a 6-digit OTP step that runs **only on the first sign-in from a given device**. Once the device + phone pair is trusted, subsequent logins skip OTP and go straight from PIN to session — across **User, Merchant, Agent, Distributor, and Super Distributor** portals.

## Important reality check (SIM detection)

Browsers **cannot** detect SIM card removal or carrier changes — that capability does not exist in the Web Platform (and even native apps require carrier-specific permissions). The closest practical equivalent is **device fingerprinting** (canvas + screen + platform hash), which we already use.

So the rule will be: **"trusted as long as the same device + same phone is used."** If the user clears browser data, switches devices/browsers, or the fingerprint changes, OTP will be re-required. This satisfies the spirit of "no re-OTP unless something changes," and is what bKash/Nagad-class apps actually do on web/PWA.

## Flow

```text
PIN entered correctly
        │
        ▼
Is (device_fp + phone) trusted? ──Yes──► Confirm step ──► Create session
        │No
        ▼
Send 6-digit OTP ──► User enters code ──► Verify ──► Mark device trusted
                          ▲                                │
                          │       Resend (60s cooldown)    ▼
                          └────────────────────────────  Confirm step
                                                            │
                                                            ▼
                                                      Create session
```

The "confirmation step" is a brief glass card showing phone + portal name with a single "Continue to dashboard" button so the user explicitly authorises session creation after device verification.

## Backend

### New table: `trusted_devices`
```text
id              uuid pk
user_id         uuid → auth.users
phone           text
device_fp       text
portal          text   -- 'user' | 'merchant' | 'agent' | 'distributor' | 'super_distributor'
last_seen_at    timestamptz
created_at      timestamptz
unique (user_id, device_fp, portal)
```
RLS: `USING (false)` — only edge functions (service role) read/write it.

### New edge functions

1. **`check-trusted-device`** — input `{ phone, device_fp, portal }` → looks up the user by phone, returns `{ trusted: boolean, user_id? }`. Used **before** sending OTP so trusted devices skip it entirely.
2. **`mark-trusted-device`** — input `{ user_id, phone, device_fp, portal }` (called by login functions only after successful auth + OTP verification) → upserts row, bumps `last_seen_at`.

### Updated edge functions

- **`merchant-login`** — accepts an optional `otp_verified: true` flag and `device_fp`. If the device isn't already trusted for that user/portal, the function **refuses to issue a session** unless `otp_verified` is true. On success, calls `mark-trusted-device`.
- **`send-otp`** — add new purpose values: `device_verify_user`, `device_verify_merchant`, `device_verify_agent`, `device_verify_distributor`, `device_verify_super_distributor`. Same OTP/rate-limit logic as today.
- **`verify-otp`** — already supports any purpose; no signature change.

## Frontend

### Shared hook: `src/hooks/use-device-otp-verification.ts`
Encapsulates: compute `device_fp`, call `check-trusted-device`, manage OTP send/verify, 60s resend cooldown, error states. Returns `{ status, sendOtp, verifyOtp, resendIn, ... }` so each login screen plugs it in identically.

### Shared UI: `src/components/DeviceOtpStep.tsx`
Reusable glass card with:
- 6-digit `InputOTP` boxes (auto-advance, paste support, dev-mode prefill from response)
- "Code sent to ••• XXXX" with masked phone
- **Resend button** disabled until 60s timer expires (live `MM:SS` countdown)
- Error toast for wrong code; auto-clear on retry
- Loader on Verify

### Shared confirmation step: `src/components/DeviceVerifiedConfirm.tsx`
Premium "Device verified ✓" card showing portal badge + masked phone + a single primary "Continue to dashboard" button. Prevents accidental auto-redirect after verification — user explicitly proceeds.

### Per-portal wiring

| Portal              | File                                | Hook into                                       |
|---------------------|-------------------------------------|------------------------------------------------|
| User                | `src/pages/AuthPage.tsx`            | After PIN success in `login_pin` mode          |
| Merchant            | `src/pages/MerchantLoginPage.tsx`   | After `handleSignIn` PIN+phone validates       |
| Agent (login)       | `src/pages/AgentDashboard.tsx` entry guard / agent login | After PIN, before dashboard mount      |
| Distributor         | `src/pages/DistributorDashboard.tsx` entry / login flow  | Same pattern                                   |
| Super Distributor   | `src/pages/SuperDistributorDashboard.tsx` entry / login  | Same pattern                                   |

For Agent / Distributor / Super Distributor that currently reuse `AuthPage` or merchant-style login, we route through the same `useDeviceOtpVerification` hook with the appropriate `portal` value so behavior is identical.

### Where the OTP delivery happens

`send-otp` currently logs the OTP to function logs in dev (`dev_otp` is also returned in the JSON response). We'll keep that for testing — production SMS is wired through the same function and will send via the existing SMS pipeline used by `pin_reset` and `payment` purposes.

## Trust persistence semantics

- Trust is keyed on `(user_id, device_fp, portal)`.
- The `device_fp` is canvas+screen+platform hash already produced by `getDeviceFingerprint()`.
- Cleared browser storage → new fingerprint → OTP re-required (correct behaviour).
- Different browser/device → different fingerprint → OTP re-required.
- Same device, same phone, repeated logins → **no OTP, ever again**. Matches the "won't ask again unless SIM removed" intent as closely as the web platform allows.

## Files to add

- `supabase/migrations/<ts>_trusted_devices.sql`
- `supabase/functions/check-trusted-device/index.ts`
- `supabase/functions/mark-trusted-device/index.ts`
- `src/hooks/use-device-otp-verification.ts`
- `src/components/DeviceOtpStep.tsx`
- `src/components/DeviceVerifiedConfirm.tsx`

## Files to edit

- `supabase/functions/merchant-login/index.ts` — gate session on `otp_verified` for untrusted devices; call `mark-trusted-device` on success
- `supabase/functions/send-otp/index.ts` — accept new `device_verify_*` purposes
- `src/pages/MerchantLoginPage.tsx` — insert OTP + confirm steps
- `src/pages/AuthPage.tsx` — insert OTP + confirm steps in user `login_pin` flow
- Agent / Distributor / Super-Distributor login entry points — same hook integration
- `mem://auth/system` — document the trusted-device + first-login OTP rule

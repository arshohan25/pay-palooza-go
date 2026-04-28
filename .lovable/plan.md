# Server-Gated Device Verification with Signed Trust Tokens

## Goal

Make device verification a **hard server-side gate** before any merchant (and other portal) session is created on first login, and let returning users skip OTP via a **server-signed verified-device token** — not a client-side localStorage flag.

Today: `merchant-login` returns session tokens immediately; the client decides whether to call OTP and whether to mark the device trusted. A tampered client can skip OTP entirely. The "trusted device" check also fronts a `localStorage` flag that bypasses the server round-trip.

After: the server is the source of truth. Sessions are only handed back when the device is proven trusted (returning user) or proven OTP-verified (first login).

## What changes

### 1. Database

Add columns to `trusted_devices`:
- `token_hash text` — SHA-256 of the verified-device token issued to this device
- `token_expires_at timestamptz` — rotation window (e.g. 90 days)
- `revoked_at timestamptz null`

Index on `(user_id, portal, device_fp)` already exists via the unique constraint; add a partial index on `token_hash` for lookup.

### 2. Edge functions

**New: `device-trust-token` (POST)**
- Input: `{ phone, device_fp, portal, token }` — called with **no** user JWT
- Looks up `profiles.id` by phone, then row in `trusted_devices` matching `(user_id, device_fp, portal)` where `revoked_at IS NULL` and `token_expires_at > now()` and `token_hash = sha256(token)`
- Returns `{ trusted: true, user_id }` only if all match. Bumps `last_seen_at`.
- This is what `merchant-login` calls internally to honor the trust token.

**Updated: `merchant-login`**
- New required field in body: `device_fp` (string, ≥16 chars)
- New optional field: `device_token` (the previously issued trust token) and `otp_ticket` (one-time ticket from `verify-otp`, see below)
- After successful PIN auth + merchant role check, **before returning session tokens**:
  - If `device_token` present → validate via the same logic as `device-trust-token`. If matches the authenticated `user.id`, return session tokens + `device_verified: true`.
  - Else if `otp_ticket` present → validate ticket (see #3). On match, **issue a new device trust token** (random 32-byte base64url), store its SHA-256 + 90-day expiry on a new `trusted_devices` row, return session tokens + `{ device_token, device_token_expires_at }`.
  - Else → **do not return session tokens**. Respond `200 { ok: true, requires_device_verification: true, otp_required: true }` plus a short-lived `pending_login_id` (signed JWT, 5 min) that the client must present alongside the OTP ticket on the retry.
- All branches: never expose any `access_token`/`refresh_token` until device is proven.

**Updated: `verify-otp`**
- On success for `purpose = device_verify_*`, return a one-time `otp_ticket` (signed JWT, 2 min, payload `{ phone, portal, purpose, jti }`, `jti` recorded in a small `otp_tickets_used` table to prevent reuse).
- The client passes this ticket back to `merchant-login` (and the equivalent for other portals).

**Deprecated:** `check-trusted-device` and `mark-trusted-device` are no longer the trust source. We keep `check-trusted-device` only as a UX hint ("this device looks trusted, will skip OTP") returning `{ trusted_hint: boolean }`. `mark-trusted-device` is removed (server now mints tokens itself).

### 3. Client

`use-device-otp-verification.ts`
- Replace the `localStorage` "trusted" flag with a stored opaque token: `mfs_devtok_{portal}_{phone}` = `{ token, expires_at }`.
- New helpers:
  - `getStoredDeviceToken(phone)` → `{ token } | null` (returns null if expired)
  - `storeDeviceToken(phone, token, exp)`
  - `clearDeviceToken(phone)` (called on logout / on 401 from token check)
- `checkTrusted(phone)` becomes a UX hint only; the real gate happens in the login function call.

`MerchantLoginPage.tsx` flow:
1. User submits PIN.
2. Read stored device token (if any).
3. Call `merchant-login` with `{ phone, pin, device_fp, device_token? }`.
4. **If response has session tokens** → straight to confirm step → `setSession` → dashboard. (Returning trusted user, no OTP shown.)
5. **If response is `requires_device_verification`** → send OTP, show `DeviceOtpStep`, on verify get an `otp_ticket`, then call `merchant-login` again with `{ phone, pin, device_fp, otp_ticket, pending_login_id }`. Server returns session tokens + new `device_token` → store it, confirm, dashboard.
6. On any 401 from a stored token, drop it and fall back to OTP.

Apply the same client wiring to `AuthPage.tsx` for user / agent / distributor / super-distributor (each portal has its own login function — same pattern: add `device_fp` + `device_token`/`otp_ticket` to the request, gate session creation server-side).

### 4. Logout / device revoke

- On manual logout, call a tiny `revoke-device-token` function that sets `revoked_at = now()` for the row matching the current token hash, then clear local storage.
- Admin already has visibility into `trusted_devices`; nothing extra needed there.

## Security properties

- A tampered or replayed client cannot obtain a session without either a valid unrevoked device token *or* a fresh OTP ticket — both bound to `(user_id, device_fp, portal)` server-side.
- Trust tokens are opaque, hashed at rest, expire in 90 days, and are revocable.
- OTP tickets are single-use (jti tracked) and expire in 2 minutes.
- Device fingerprint is checked server-side as part of token validation, so swapping devices invalidates the token even if the token leaks.

## Files

**New**
- `supabase/functions/device-trust-token/index.ts`
- `supabase/functions/revoke-device-token/index.ts`
- `supabase/migrations/<ts>_trusted_device_tokens.sql` (columns + `otp_tickets_used` table)

**Edited**
- `supabase/functions/merchant-login/index.ts` (gate session, accept token/ticket, mint token)
- `supabase/functions/verify-otp/index.ts` (issue otp_ticket for `device_verify_*` purposes)
- `supabase/functions/check-trusted-device/index.ts` (downgrade to hint-only)
- `supabase/functions/user-login`, `agent-login`, `distributor-login`, `super-distributor-login` (same gating as merchant-login — exact filenames confirmed during implementation)
- `src/hooks/use-device-otp-verification.ts` (token storage, ticket plumbing)
- `src/pages/MerchantLoginPage.tsx` (two-call flow, no client-side trust decision)
- `src/pages/AuthPage.tsx` (same for the other four portals)

**Removed**
- `supabase/functions/mark-trusted-device/index.ts` (server now mints tokens itself)

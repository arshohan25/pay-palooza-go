## Server-Side PIN Attempt Rate Limiting for Merchant Login

### Caveat
The backend has no official rate-limiting primitives yet. This is an ad-hoc implementation (custom edge function + DB table) per your direction. It may need to be replaced when proper infra ships.

### Goal
Track failed merchant-login PIN attempts server-side, block further sign-in attempts after a threshold, and return a consistent lockout response the merchant login page can render.

### Behavior
- **Identifier**: keyed on normalized phone number (`01XXXXXXXXX`) plus best-effort client IP from request headers.
- **Threshold**: 5 failed attempts within a 15-minute rolling window → 15-minute lockout.
- **Successful login**: clears the phone's attempt log.
- **Stale rows**: expired rows ignored at read time; a DB function purges anything older than 24 h.

### Database (migration)
New table `merchant_login_attempts`:
- `id uuid pk default gen_random_uuid()`
- `phone text not null` (indexed)
- `ip text` (nullable)
- `success boolean not null default false`
- `created_at timestamptz not null default now()` (indexed)

RLS: enabled, **no policies** (only the edge function with service role can read/write).

Helper SQL function `check_merchant_login_lockout(p_phone text)` returning `{ locked boolean, attempts_remaining int, retry_after_seconds int }`. Counts failed rows in the last 15 min.

### Edge function: `merchant-login`
`supabase/functions/merchant-login/index.ts` (verify_jwt = false; this is a pre-auth endpoint).

Request body (validated with Zod):
```ts
{ phone: string, pin: string }
```

Flow:
1. CORS preflight handling.
2. Validate body; reject 400 on bad shape.
3. Normalize phone (`replace(/\D/g, "").replace(/^88/, "")`); validate against BD regex.
4. Call `check_merchant_login_lockout(phone)`. If locked → return **HTTP 429** with body `{ locked: true, retry_after_seconds, attempts_remaining: 0, message }`.
5. Build synthetic email (`{phone}@easypay.app`) and password (`pin + "EP"`); call `supabase.auth.signInWithPassword` using a service-role client (it still validates credentials normally — service role only for DB ops).
6. **On auth failure**:
   - Insert `{ phone, ip, success: false }` row.
   - Recompute lockout. If now locked → return **429** with lockout payload. Otherwise return **401** with `{ ok: false, attempts_remaining, message: "Wrong phone or PIN" }`.
7. **On auth success**:
   - Verify the user has `merchant` or `admin` role. If not → return **403** `{ ok: false, message: "Not a merchant account" }` (no attempt insert; treat as policy block, not credential failure).
   - Insert `{ phone, ip, success: true }`.
   - Delete prior failed rows for this phone (clean slate).
   - Return **200** `{ ok: true, session: <auth-session>, user: <user> }`. Client uses `supabase.auth.setSession()` with the returned tokens.

IP extracted from `x-forwarded-for` (first hop) or `cf-connecting-ip` headers; fall back to `null`.

### Client wiring (`src/pages/MerchantLoginPage.tsx`)
- Replace direct `signIn(phone, pin)` call with `supabase.functions.invoke("merchant-login", { body: { phone, pin } })`.
- Handle response:
  - `200` + `session`: call `supabase.auth.setSession({ access_token, refresh_token })`, then continue with the existing post-login navigation/role checks (kept as defense-in-depth).
  - `429`: persist `retry_after_seconds` to `localStorage` and render the cooldown UI added in the prior plan (live countdown, disabled inputs, destructive banner). Toast: "Too many failed attempts. Locked for X minutes."
  - `401`: show "Wrong phone or PIN — N attempts left" toast using `attempts_remaining`.
  - `403`: show existing "This account isn't a merchant account" message; no lockout state.
- Keep client-side optimistic counter as a UX hint, but treat the server response as authoritative.

### Files
- New: `supabase/migrations/<ts>_merchant_login_attempts.sql`
- New: `supabase/functions/merchant-login/index.ts`
- Edited: `src/pages/MerchantLoginPage.tsx`

### Out of scope
- Per-IP global limits (would need a different identifier strategy).
- CAPTCHA after lockout (can be layered later).
- Distributed rate limiting across regions — single-table approach is sufficient here.

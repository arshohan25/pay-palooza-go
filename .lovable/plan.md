

## Plan: Add API Security Enhancements

### What
Add the 5 identified security gaps to EasyPay's API integration: **Environment Separation** (test/live keys), **Key Rotation**, **Scoped Permissions**, **Idempotency**, and **Replay Protection**.

### Database Migration

Add columns to `merchant_api_keys`:
- `environment` (text, default `'live'`, check `test` or `live`)
- `permissions` (text[], default `'{create_session,check_status,list_sessions}'`)
- `rotation_expires_at` (timestamptz, nullable) — old key stays valid until this time during rotation

Add new table `merchant_idempotency_keys`:
- `id` uuid PK
- `merchant_id` uuid FK
- `idempotency_key` text NOT NULL
- `session_id` uuid FK to merchant_payment_sessions
- `created_at` timestamptz
- UNIQUE constraint on `(merchant_id, idempotency_key)`

### Edge Function: `merchant-payment-api/index.ts`

1. **Environment check** — test keys can only create sessions with `test_mode: true` metadata; test sessions don't process real payments
2. **Permissions check** — validate `action` against `keyRow.permissions` array; reject unauthorized actions with 403
3. **Idempotency** — accept `X-Idempotency-Key` header; on `create_session`, check `merchant_idempotency_keys` first; if exists, return cached session; otherwise insert new record
4. **Replay protection** — require `X-EasyPay-Timestamp` header; reject requests older than 5 minutes
5. **Key rotation** — if key is inactive but `rotation_expires_at > now()`, still allow requests (grace period)

### Admin UI: `AdminApiKeys.tsx`

1. **Environment badge** — show "Test" or "Live" badge per key
2. **Environment toggle** when generating new keys — radio for Test/Live
3. **Permissions editor** — multi-select checkboxes for `create_session`, `check_status`, `list_sessions`, `refund`
4. **Rotate key button** — generates new key pair, sets `rotation_expires_at` on old key (24h grace), marks old key inactive after expiry
5. **Rotation indicator** — show "Rotating (expires in Xh)" badge on keys in grace period

### Files Changed
- **Migration SQL** — new columns + new table
- `supabase/functions/merchant-payment-api/index.ts` — add 5 security checks
- `src/components/admin/AdminApiKeys.tsx` — environment, permissions, rotation UI


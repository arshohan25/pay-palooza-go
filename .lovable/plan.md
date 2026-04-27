# Credential manager: create / rotate / revoke API keys

## Current state
The API tab (`src/components/MerchantApiTab.tsx`) already shows existing credentials with masking, copy buttons, status badges, and webhook editing. What's missing is merchant-side **lifecycle controls**: a merchant cannot create a new key pair, rotate an existing pair, or revoke one — keys today only appear after admin processes a request.

RLS on `merchant_api_keys` already permits approved merchants to INSERT / UPDATE / DELETE their own rows (`has_merchant_api_access(auth.uid())` + ownership check). So this can be done **entirely client-side** — no edge function, no migration.

## Build
Single file: `src/components/MerchantApiTab.tsx`

Add a new **Credential Manager** section that renders only when the merchant has API access (i.e. when `requests` has an `approved` row, matching the existing access gate). It sits above the existing "Your API Credentials" list and offers three actions per key plus a "Create new key" CTA.

### 1. Generation helpers (top of file)

```ts
const genKey = (prefix: "live" | "test") => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_pk_${hex}`;        // public/api key
};
const genSecret = (prefix: "live" | "test") => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_sk_${hex}`;        // secret key
};
const genAppPassword = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "").slice(0, 24);
};
```

### 2. Actions

- **Create** — inserts a new row with `merchant_id`, `api_key`, `secret_key`, `app_password`, `environment` (default `live`, with a Test/Live toggle), `is_active: true`, and the default permissions. Block creation when access not approved; cap at e.g. 5 active keys per merchant with a friendly toast.
- **Rotate** — generates a fresh `api_key` + `secret_key` + `app_password` and `UPDATE`s the existing row in place, plus sets `rotation_expires_at = now() + 24h` so dependent code sees the rotation event. Show a confirmation dialog warning that the old credentials stop working immediately.
- **Revoke** — `UPDATE { is_active: false }`. Show a confirmation; revoked keys remain visible (greyed out, badge "Revoked") so logs and historical sessions still link correctly. Provide a separate "Delete permanently" action only for already-revoked keys (DELETE row).

All three actions:
- run optimistically + `await loadData()` for re-sync
- fire toasts on success/failure (reuse `useToast`)
- the realtime subscription already on `merchant_api_keys` will mirror the change in other open tabs

### 3. UI layout (per key card additions)

Below the existing webhook row in each key card, add a control strip:

```text
[ Active ] live   created 27 Apr   rotates in 23h
─────────────────────────────────────────────────
[ Rotate ]  [ Revoke ]      (or [ Delete ] when revoked)
```

Status indicators on the card header:
- `Active` — emerald dot + "Active"
- `Revoked` — muted dot + "Revoked" + warning text "Cannot make API calls"
- `Rotating` — amber dot + "Rotation pending" when `rotation_expires_at` is in the future

Section header gets a primary-styled **+ Create new key** button (disabled with tooltip when no approved request or when at the cap).

### 4. Copy-to-clipboard

The existing `copyText` helper already provides per-field copy with a 2s checkmark confirmation; the new Create flow reuses it. After creating a key, auto-open the new card and reveal the secret + app password once with a one-time banner: "Copy these now — you can re-reveal later but rotate immediately if exposed."

## Out of scope
- No DB migration: schema and RLS already support all three actions.
- No edge function: writes go straight from the merchant client under existing RLS.
- No changes to admin-side request flow, the access gate, or analytics.
- No multi-environment dashboard (test vs live separation beyond the existing `environment` field on each key).

Approve to apply.
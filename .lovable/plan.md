## Goal
Make the client strictly honor the server's lockout response so a locked merchant cannot re-submit the PIN form until the cooldown ends — across tabs, across reloads, and across the Enter key / programmatic submits.

## Current state (already implemented)
- `mfs_merchant_login_locked_until` persisted in `localStorage`; restored on mount.
- 1-second ticker computes `isLocked` / `remainingSeconds`; auto-clears at expiry.
- `applyLockout(retry_after_seconds)` set on every 429 response from `merchant-login`.
- `handleSignIn` returns early if `loading || isLocked`.
- Submit button, PIN `InputOTP`, and phone `Input` are `disabled={isLocked}`.
- Lockout banner + countdown label render while locked.

## Gaps to close
1. **Cross-tab sync** — opening the login page in a second tab right now starts with no lock state until the next failed attempt. Listen to `storage` events on `mfs_merchant_login_locked_until` so a lockout in tab A immediately freezes tab B.
2. **Form-level Enter / autofill submit** — `handleSignIn` guards against locked, but the `<form onSubmit>` should also be no-op'd defensively, and the form itself can carry `aria-disabled` for AT users.
3. **Edge function `error.context` 429 parsing** — `supabase.functions.invoke` throws `FunctionsHttpError` on non-2xx. Today we read `error.context.body` then fall back to `error.context.text()`. Add one more fallback path: `(error as any)?.context?.json?.()` (newer client) and also read the `Retry-After` header if `retry_after_seconds` is missing in the body, so the cooldown is always populated.
4. **Trust the server clock** — currently we compute `lockedUntil = Date.now() + retry_after_seconds*1000`. If the user's clock is skewed, lock can expire too early/late on the client but the server will still 429. On the next 429, just re-call `applyLockout` with the fresh `retry_after_seconds` so the countdown self-corrects (already happens) — also, when `isLocked` flips false, do NOT auto-clear `attemptsRemaining` until the next response (keeps "X attempts left" meaningful right after cooldown).
5. **A11y / UX polish** — set `aria-live="polite"` on the lockout banner, and `inert` (or `pointer-events-none`) on the form body while locked so password managers can't re-trigger submit.

## Changes (single file)
**`src/pages/MerchantLoginPage.tsx`**
- Add a `window.addEventListener("storage", ...)` effect that re-reads `LS_LOCKED_UNTIL` and calls `setLockedUntil` accordingly (handles both lock-set and lock-clear events).
- In `handleSignIn`, after the existing `if (loading || isLocked) return;`, also check the freshest localStorage value (in case the ticker hasn't fired yet) and bail.
- Wrap the form contents in a `<fieldset disabled={isLocked}>` so every interactive control — including any future ones — is disabled in one place; keep the explicit `disabled` props as belt-and-suspenders.
- Improve the 429 body extraction: try `error?.context?.json?.()` and `error?.context?.headers?.get?.("retry-after")` before falling back to 900s.
- Add `aria-live="polite"` to the lockout banner div.

## Out of scope
- No backend or migration changes — server-side `merchant-login` + `check_merchant_login_lockout` already returns the canonical `retry_after_seconds` and `Retry-After` header.
- No new recovery / "forgot PIN" UI here.
- Visual identity unchanged (same glass card, 19px radii, emerald accents).

## Files touched
- `src/pages/MerchantLoginPage.tsx` (only)

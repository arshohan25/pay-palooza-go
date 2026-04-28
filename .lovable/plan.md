# Auto-redirect on Session Expiry — Merchant Routes

## Problem

`RoleGuard` redirects unauthenticated users to `/merchant-login` only on its initial mount + when `useAuth()` flips. Two gaps remain:

1. **Silent expiry** — when Supabase's refresh token is revoked or expires, the SDK may not emit `SIGNED_OUT` until the next API call fails. A merchant left idle on `/merchant` can sit there with a stale UI.
2. **No feedback or return path** — when the redirect does fire, the user lands on the login page with no explanation and is dropped onto `/merchant` afterwards even if they were deep in a tab.

## Solution

Add a lightweight **global session watchdog** that runs whenever the user is on a merchant route, plus a small login-page tweak to honor a return path.

### Behavior

- On `SIGNED_OUT` or `TOKEN_REFRESHED` with no session → toast "Your session has expired. Please sign in again." and `navigate("/merchant-login?redirect=<current-path>", { replace: true })`.
- Every 30s, read the cached session and, if `expires_at` is within 60s, proactively call `supabase.auth.refreshSession()`. On failure → same redirect path.
- Watchdog only mounts when location pathname starts with `/merchant` (excluding `/merchant-login`), so other portals are unaffected.
- After successful login on `MerchantLoginPage`, if `?redirect=` is present and starts with `/merchant`, navigate there instead of the default `/merchant`. Whitelisting prevents open-redirect abuse.

## Files

### New: `src/hooks/use-merchant-session-watchdog.ts`
- Subscribes to `supabase.auth.onAuthStateChange`.
- 30s `setInterval` that proactively refreshes near-expiry tokens.
- On any expiry signal: `toast.error(...)` (sonner) + `navigate("/merchant-login?redirect=...", { replace: true })`.
- Cleans up listener + interval on unmount.

### New: `src/components/MerchantSessionWatchdog.tsx`
- Tiny wrapper component (returns `null`) that calls the hook.
- Mounted globally in `App.tsx` so it covers `/merchant` and any future merchant sub-routes without each page opting in.
- Internally checks `useLocation()` and no-ops outside `/merchant*` paths.

### Edit: `src/App.tsx`
- Render `<MerchantSessionWatchdog />` inside `<BrowserRouter>` alongside `<Routes>`.

### Edit: `src/pages/MerchantLoginPage.tsx`
- Read `redirect` from `useSearchParams()`.
- After successful login, if `redirect` starts with `/merchant` → navigate there; otherwise keep current default.

## Technical Notes

- We don't change `RoleGuard` — it still enforces the route. The watchdog only ensures the auth state actually flips promptly so the guard can act.
- Supabase auto-refreshes tokens, but the watchdog is a safety net for tabs left open across long idle periods or when the refresh token is revoked server-side (PIN reset, admin force-logout).
- Compatible with the disabled `useSessionTimeout` policy — this is server-token-expiry-driven, not idle-driven.
- Toast uses the existing sonner instance already mounted in `App.tsx`.
- Redirect param is whitelisted to `/merchant*` only.

## Out of Scope

- Same pattern for agent / distributor / super-distributor / admin portals (can be added later by reusing the hook with different prefixes).
- Changing Supabase token lifetimes.

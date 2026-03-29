

# Ensure Authenticated Users Never See Auth Page Again

## Current Behavior
The app already uses Supabase's persisted session (`persistSession: true`) to skip the auth page for logged-in users. However, the splash screen and onboarding still replay on every new browser tab because `splashDone` uses `sessionStorage` (cleared per tab/session) and `onboardingDone` uses `localStorage` (persists).

The real issue: when a logged-in user opens a new tab, there's a brief `authLoading` window where the session hasn't resolved yet. During this window, the code falls through to `!isAuthenticated` and shows splash → onboarding → auth page before the session loads.

## Plan

### File: `src/pages/Index.tsx`

1. **Use `localStorage` for `splashDone` instead of `sessionStorage`** — so it persists across tabs and browser restarts, matching the user's expectation that once logged in, these screens never appear again.

2. **Guard splash/onboarding behind a "never logged in" check** — add a `localStorage` flag `mfs_has_authenticated` that is set to `"1"` after successful first login. If this flag exists, skip splash, onboarding, AND auth page display entirely (show loading skeleton instead while `authLoading` resolves).

3. **Set the flag on authentication** — in the `AuthPage onAuthenticated` callback and also when `isAuthenticated` becomes true, persist `localStorage.setItem("mfs_has_authenticated", "1")`.

4. **Clear the flag on sign-out** — in the `signOut` function (already in `use-auth.ts`), remove `mfs_has_authenticated` so the auth page becomes accessible again after explicit logout.

### File: `src/hooks/use-auth.ts`

5. **Add `mfs_has_authenticated` to the signOut cleanup list** — ensures clearing app data or signing out resets access to the auth page.

### Logic Summary

```text
App opens
  → Check localStorage("mfs_has_authenticated")
  → If "1" AND authLoading: show skeleton (not splash/auth)
  → If "1" AND isAuthenticated: show dashboard
  → If "1" AND !isAuthenticated AND !authLoading: session expired → clear flag, show auth
  → If not set: show splash → onboarding → auth (normal first-time flow)
```

## Files Changed
- `src/pages/Index.tsx` — add `hasAuthenticated` localStorage check, skip splash/onboarding/auth when flag is set
- `src/hooks/use-auth.ts` — clear `mfs_has_authenticated` on signOut




# Skip Auth Page for Returning Logged-in Users

## Problem
After a successful login, revisiting the app shows the splash screen (every new browser session) and potentially flashes the auth page before the Supabase session resolves. The user wants to go straight to the home dashboard if already authenticated.

## Solution
Reorder the checks in `Index.tsx` so the **auth loading state is resolved first**, before showing splash/onboarding/auth screens. If the user is already authenticated, skip splash, onboarding, and auth page entirely.

## Changes (single file: `src/pages/Index.tsx`)

1. **Move `authLoading` check to the top** — before splash and onboarding checks. Show skeleton while auth resolves.

2. **Skip splash screen if authenticated** — change the splash condition from `!splashDone` to `!splashDone && !isAuthenticated`. Returning logged-in users go straight to home.

3. **Skip onboarding if authenticated** — change the onboarding condition to also require `!isAuthenticated` (unless `replayOnboarding` is explicitly set).

The auth page overlay at line 400 (`!isAuthenticated`) remains unchanged as a fallback for unauthenticated users who complete splash/onboarding.

## Flow After Fix

```text
Before:  Splash → Onboarding → Auth loading → Auth page / Home
After:   Auth loading → (if authenticated) → Home
                       → (if not authenticated) → Splash → Onboarding → Auth page
```


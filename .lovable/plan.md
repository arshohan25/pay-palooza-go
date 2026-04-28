# Why your manager is seeing the wrong page

## Root cause

When a Manager (e.g. `AR / 01680693484`) signs in via `/merchant-manager-login` and lands on `/merchant`, two things have to be resolved in parallel:

1. **`useStaffAccess`** — calls the `get_staff_merchant_access` RPC to check if this user is staff for any merchant.
2. **`MerchantDashboard.loadData`** — checks the `user_roles` table for the `merchant` role.

The dashboard logic at `src/pages/MerchantDashboard.tsx` is:

```text
if (isStaff && staffMerchantId)  → render dashboard as staff   ✓
else                             → query user_roles
   if has 'merchant' role        → render dashboard as owner   ✓
   else                          → render MerchantBenefitsPage ✗  ← THIS IS WHAT YOU'RE SEEING
```

A staff member never has the `merchant` role (only the owner does). So the moment `useStaffAccess` resolves with `isStaff=false`, the page commits to the "Become a Vendor" benefits screen.

The data in the database is correct — `AR` is `is_active=true`, `linked=true`, merchant status `active`. The bug is purely a client-side race:

- `useStaffAccess` doesn't depend on `useAuth().user`. It calls `supabase.auth.getSession()` itself once on mount. If that runs before the auth session has rehydrated from `localStorage` (the well-known `INITIAL_SESSION` race documented in our project notes), `session?.user` is `null`, the RPC is skipped, `isStaff` is set to `false`, and `loading` becomes `false`.
- The `onAuthStateChange` re-fetch inside the hook doesn't reset `loading=true`, and it `await`s inside the callback (against Supabase guidance), so the second pass can be swallowed.
- `MerchantDashboard` only waits for `staffLoading`, not for a definitive "staff resolution complete" signal, so once `staffLoading=false` with `isStaff=false`, it commits to the benefits page.

There is also a defensive gap: the dashboard's "no merchant role → benefits page" branch never re-checks staff status if it later flips true.

## The fix

1. **Make `useStaffAccess` resilient (`src/hooks/use-staff-access.ts`)**
   - Re-set `loading = true` whenever auth state changes so the dashboard knows to wait again.
   - Don't `await` inside the `onAuthStateChange` callback. Schedule the refetch with `setTimeout(fetch, 0)` (Supabase-recommended pattern) to avoid the listener deadlock.
   - Fall back to `supabase.auth.getUser()` if `getSession()` returns no user yet, to handle the cold-start race.
   - Retry the RPC once after ~300 ms when the first call returns no rows but a session exists, to absorb token-attachment lag.

2. **Make `MerchantDashboard` (`src/pages/MerchantDashboard.tsx`) require a definitive answer before showing the benefits page**
   - Track a `staffResolved` flag (true once the staff hook has completed at least one successful resolution after auth is ready).
   - Only render `<MerchantBenefitsPage />` when `isMerchant === false` **and** `staffResolved === true` **and** `isStaff === false`. Otherwise keep showing the loading spinner.
   - Re-run `loadData` whenever `isStaff` flips, even after the first resolution (already wired via deps — verified).

3. **Belt-and-braces guard at the route level (`src/App.tsx`)**
   - The `/merchant` `RoleGuard` already passes `allowStaff`, but it currently lets the page render even if neither role nor staff resolves cleanly. Add a small follow-up: if a user lands on `/merchant` with no merchant role and no staff link after both checks complete, redirect to `/merchant-login` instead of silently falling into the benefits page (only when the user is truly neither).

4. **Diagnostic log** (temporary): add a single `console.info` in `useStaffAccess` and `MerchantDashboard.loadData` so if the issue recurs we can confirm timing in the user's preview console.

## Files touched

- `src/hooks/use-staff-access.ts` — race-safe resolution, no async inside `onAuthStateChange`, retry-once.
- `src/pages/MerchantDashboard.tsx` — gate the `MerchantBenefitsPage` branch behind `staffResolved`.
- `src/App.tsx` (small) — tighten `/merchant` fallback redirect when both checks are conclusively negative.

## What you'll see after the fix

When the manager `AR` opens `/merchant`:
- Spinner stays until the staff RPC resolves.
- Staff resolution returns the `Rafiq Electronics` link.
- The merchant dashboard renders with the staff-allowed tabs (no "Become a Vendor" page).

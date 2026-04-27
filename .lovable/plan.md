## Add Logout Button to Merchant Dashboard Header

### Goal
Add a logout button to the merchant dashboard header that clears the session and redirects back to `/merchant-login`.

### Changes

#### 1. `src/pages/MerchantDashboard.tsx`
- **Destructuring**: Extract `signOut` from the `useAuth()` hook call (line ~160).
- **Add logout handler**: Create `handleLogout` async function that:
  1. Calls `await signOut()`
  2. Navigates to `/merchant-login` with `replace: true`
- **Add logout button**: In the header button group (around line ~393, next to the refresh and menu buttons), add a new `LogOut` icon button with:
  - `whileTap` scale animation
  - `glass-hero` styling (matching existing header buttons)
  - `onClick={handleLogout}`
  - `aria-label="Logout"`
- **Import `LogOut` icon**: Add `LogOut` to the existing Lucide icon import block (already present in the large import list at line ~23).

### Technical Details
- The `useAuth` hook already exports a `signOut` function that clears `localStorage` keys (`mfs_user_name`, `mfs_registered_phone`, `mfs_display_photo`, `mfs_cached_user_id`, `mfs_has_authenticated`, `splashDone`) and calls `supabase.auth.signOut()`.
- The redirect to `/merchant-login` ensures the user lands on the merchant-specific login page, not the general customer login.
- The logout button will visually match the existing `glass-hero` header buttons (refresh, menu) for consistency.

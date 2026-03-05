## Analysis

The name "Tanvir Hasan" and phone "01334672345" shown on the Account page **do not exist in the database**. The database only contains:

- **Shohan** (01909709954)
- **Abdur Rahman** (01680693484)

These are **stale localStorage values** left over from a previous session. The Account page reads `mfs_registered_phone` from localStorage (line 143) and the `useProfile` hook initializes `name` from `localStorage.getItem("mfs_user_name")`.

## Root Cause

When you log in as a different user, the old localStorage values are not being cleared, so the UI briefly (or permanently, if the DB fetch fails) shows the old cached identity.

## Plan

Since there is no database record to delete, the fix is to **clear the stale localStorage cache**. There are two things to do:

### 1. Clear stale localStorage now

You need to manually clear it in your browser: open the preview, open DevTools → Application → Local Storage, and delete `mfs_user_name`, `mfs_registered_phone`, and `mfs_display_photo`. Then refresh. Clear it by your self

### 2. Fix the code to prevent this from recurring

Update the auth sign-out flow and the auth state change listener to clear identity-related localStorage keys when the user logs out or when a different user logs in. This ensures no stale identity data persists across sessions.

**File: `src/hooks/use-auth.ts**`

- In the `signOut` callback, clear `mfs_user_name`, `mfs_registered_phone`, and `mfs_display_photo` from localStorage before signing out.

**File: `src/hooks/use-profile.ts**`

- On auth state change (user switches), detect if the current user ID differs from the cached one and clear stale localStorage values before fetching fresh data.


## Fix: Account Page Shows Hardcoded "Tanvir Hasan" Instead of Database Name

### Root Cause

`src/components/ProfileEditFlow.tsx` line 15:
```typescript
export const getDisplayName = () => localStorage.getItem("mfs_display_name") ?? "Tanvir Hasan";
```

The AccountPage uses `getDisplayName()` / `getDisplayPhoto()` from ProfileEditFlow, which reads from `mfs_display_name` localStorage key with a hardcoded fallback of "Tanvir Hasan". This is completely disconnected from the database and from `useProfile()`.

### Fix

**`src/pages/AccountPage.tsx`**: Replace the `getDisplayName` / `getDisplayPhoto` localStorage-based state with `useProfile()` hook data. The profile card should use `displayName` from `useProfile()` instead of maintaining separate `displayName` / `displayPhoto` state from localStorage.

1. Import and use `useProfile()` for the name shown in the profile card
2. Remove `displayName` and `displayPhoto` local state that reads from `getDisplayName()`
3. Keep `getDisplayPhoto` for the avatar (since photos are still localStorage-based), but use `useProfile().displayName` for the name
4. In `handleProfileSaved`, just trigger a re-fetch (the `profile-updated` event already does this)

**`src/components/ProfileEditFlow.tsx`**: Change the hardcoded fallback from `"Tanvir Hasan"` to `"My Wallet"` so if localStorage is empty, it shows a generic name instead of a specific person's name.

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/AccountPage.tsx` | Use `useProfile().displayName` for profile card name instead of `getDisplayName()` |
| `src/components/ProfileEditFlow.tsx` | Change fallback from `"Tanvir Hasan"` to `"My Wallet"` |


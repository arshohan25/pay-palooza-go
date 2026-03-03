

## Fix: Profile Name Not Syncing to BalanceCard

### Root Cause

The `ProfileEditFlow` component saves the edited name only to **localStorage** (key `mfs_display_name`), but the `useProfile` hook reads the name from the **database** (`profiles.name` column) and uses a different localStorage key (`mfs_user_name`). The name is never written back to the database when the user edits their profile.

The database still has `name: "Rafiq Ahmed"` even though the user changed it to "Shohan" in the profile editor.

### Fix

Two changes needed:

#### 1. `src/components/ProfileEditFlow.tsx` -- Save name to database
In `handleSave`, after setting localStorage, also update `profiles.name` in the database (same pattern as the email update that already exists):

```typescript
// After setDisplayName / setDisplayPhoto, update DB
const { data: { session } } = await supabase.auth.getSession();
if (session?.user) {
  await supabase
    .from("profiles")
    .update({ name: name.trim() })
    .eq("user_id", session.user.id);
}
```

Also sync the `mfs_user_name` localStorage key so `useProfile`'s initial state is correct:
```typescript
localStorage.setItem("mfs_user_name", name.trim());
```

#### 2. `src/hooks/use-profile.ts` -- Add refetch capability
Add a way to re-trigger the profile fetch (e.g., listen to a storage event or expose a `refetch` function), so that after the profile edit saves, BalanceCard and SideNav pick up the new name without requiring a page reload. The simplest approach is to use a state counter or subscribe to `window` storage events.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/ProfileEditFlow.tsx` | Update `profiles.name` in DB on save, sync `mfs_user_name` localStorage key |
| `src/hooks/use-profile.ts` | Listen for localStorage changes to auto-refresh, or expose a `refetch` |


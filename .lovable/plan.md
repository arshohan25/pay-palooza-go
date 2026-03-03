

## Fix: Pre-populate ProfileEditFlow Name from Database

### Problem
Line 65 initializes the name field from localStorage (`getDisplayName()`), which may be stale or wrong. The email is already loaded from the database (lines 86-103), but the name is not.

### Fix

**`src/components/ProfileEditFlow.tsx`**:

1. Expand the existing `useEffect` (lines 86-103) that fetches `email` to also fetch `name` from `profiles`
2. When the DB name arrives, update the `name` state with `setName(data.name)`
3. Keep `getDisplayName()` as initial value (instant render), but override it once the DB responds

Change the query from `.select("email")` to `.select("name, email")`, then add:
```typescript
if (data?.name) {
  setName(data.name);
}
```

This is a minimal, single-location change inside the existing `useEffect` load function.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/ProfileEditFlow.tsx` | Fetch `name` alongside `email` in the existing useEffect, update `name` state from DB |


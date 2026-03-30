

# Fix Feature Unlock Dropdown — Exclude Already-Visible Features

## Problem
The "Feature Unlock" dropdown shows features like Cash Out, Cash In, Add Money, Payment, etc. — but these are **already visible** to users via global toggles (they're enabled by default). The dropdown should only show features that are currently **hidden or disabled** for the selected user(s), so admins can unlock features users don't have yet.

## Fix

### `src/components/admin/AdminUserPerformanceTracker.tsx`

Update `loadAvailableFeatures` to also fetch the `is_enabled` and `visibility` columns from `global_feature_toggles`, then:

1. **Exclude role-specific features** (existing prefix filter — keep as-is)
2. **Exclude globally visible features** — if `is_enabled === true` and `visibility === 'visible'` (or null/default), the user already has it → exclude
3. **Exclude features with badge/role group overrides that resolve to `visible`** — check `user_feature_overrides` for group-level rows matching the selected user's badge where `visibility = 'visible'`
4. **Exclude features the user already has a `visible` user-specific override for** (existing logic — keep as-is)

In short: only show features where the **resolved visibility** for the user is `hidden` or `disabled` — those are the ones worth unlocking.

### Logic Change
```
// Fetch global toggles with is_enabled + visibility
// Fetch all overrides (user-specific + group) for selected users
// For each feature:
//   - Skip if role-prefixed
//   - Skip if globally visible (is_enabled=true, visibility='visible')
//   - Skip if user already has visible override
//   - Skip if user's badge group has visible override
// → Only show features that are hidden/disabled for user
```

## Files Changed
- `src/components/admin/AdminUserPerformanceTracker.tsx` — Update filtering logic in `loadAvailableFeatures`


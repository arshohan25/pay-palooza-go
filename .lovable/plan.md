# Fix Feature Unlock Dropdown — Show Only Missing Features for Each Individual user

## Problem

The Feature Unlock dropdown still shows features users already have (Cash Out, Add Money, Payment, etc.) because the filter only checks for explicit `visible` user overrides. It doesn't check whether the feature is already globally enabled and visible by default.

## Fix in `src/components/admin/AdminUserPerformanceTracker.tsx`

Update `loadAvailableFeatures` to:

1. **Fetch `is_enabled` and `visibility**` from `global_feature_toggles` (currently only fetches `feature_key, label`)
2. **Also fetch badge/role group overrides** for selected users (currently only checks user-specific overrides)
3. **Compute resolved visibility** per feature using the same priority logic as `useGlobalToggles`:
  - User-specific override > Badge group override > Role group override > Global default
4. **Exclude features where resolved visibility = `visible**` — these are features the user already has
5. **Only show features resolving to `hidden` or `disabled**` — these are the ones worth unlocking

### Filtering Logic

```
For each feature:
  - Skip if role-prefixed (merchant_, agent_, etc.)
  - Check if user has a 'visible' individual override → already has it → skip
  - Check if user's badge group has a 'visible' override → already has it → skip
  - Check if globally enabled with visibility='visible' → already has it → skip
  - Otherwise → show in dropdown (user doesn't have this feature)
```

This ensures only features like "Become a Merchant", "Live Chat", "Icon Size", "Compact Mode" etc. that are actually hidden/disabled for the selected user appear in the dropdown. Future new features added to `global_feature_toggles` will automatically appear if they're not visible to the user.

## Files Changed

- `src/components/admin/AdminUserPerformanceTracker.tsx` — Update `loadAvailableFeatures` query and filtering logic
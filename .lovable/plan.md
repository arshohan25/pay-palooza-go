

# Show Only Missing Features in Feature Unlock Dropdown

## Problem
When assigning a "Feature Unlock" reward, the admin sees a free-text input for "Feature Key". Instead, it should show a dropdown listing only features the selected user(s) **don't already have** (i.e., features that are hidden/disabled for them and not yet overridden to visible).

## Changes

### `src/components/admin/AdminUserPerformanceTracker.tsx`

1. **Fetch all feature keys** — When the reward dialog opens, load all features from `global_feature_toggles` (feature_key + label)

2. **Fetch selected users' existing overrides** — Query `user_feature_overrides` for the selected user IDs where `visibility = 'visible'` to get features they already have

3. **Compute missing features** — Filter the full feature list to exclude features the user(s) already have visible overrides for. For multi-user selection, show features that at least one selected user is missing

4. **Replace Input with Select dropdown** — When `rewardType === "feature_unlock"`, replace the free-text `Input` with a `Select` dropdown populated with the missing features (showing label, value = feature_key)

5. **Empty state** — If all features are already unlocked for the selected user(s), show a message: "All features already unlocked for selected user(s)"

## Technical Detail
- Fetch features + overrides when dialog opens (`useEffect` on `rewardDialog` + `rewardType`)
- For single user selection: straightforward filter. For bulk: show union of missing features across all selected users
- Reuses existing `global_feature_toggles` table data already used in `AdminUserFeatureAccess`

## Files Changed
- `src/components/admin/AdminUserPerformanceTracker.tsx` — Replace text input with smart dropdown for feature_unlock type




# Smart Feature Dropdown for User Rewards

## What Changes
Replace the free-text "Feature Key" input in the Assign Reward dialog with a Select dropdown that only shows **user-applicable features**, excluding role-specific and already-unlocked ones.

## Filtering Logic
1. **Fetch all features** from `global_feature_toggles` when reward dialog opens with type `feature_unlock`
2. **Exclude non-user features** by prefix: `merchant_`, `agent_`, `distributor_`, `super_distributor_`, `team_`
3. **Exclude already-unlocked features** — query `user_feature_overrides` for selected user(s) where `visibility = 'visible'`, remove those feature keys from the list
4. **Show friendly labels** from the `label` column, with `feature_key` as the value

## UI
- Replace `<Input>` with `<Select>` dropdown when `rewardType === "feature_unlock"`
- Each option shows the feature label (e.g. "Live Chat" not "account_live_chat")
- If no features remain, show disabled state with message "All features already unlocked"

## File Changed
- `src/components/admin/AdminUserPerformanceTracker.tsx` — Add state for available features, fetch logic on dialog open, replace Input with Select for feature_unlock type


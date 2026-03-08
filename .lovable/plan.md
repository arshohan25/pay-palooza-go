

## Plan: Add Missing Toggle + Disabled Feature Tooltip

### 1. Insert missing `refer` toggle into `global_feature_toggles`

The only missing feature key is `refer`. All others (`bank_transfer`, `savings`, `mobile_recharge`, `pay_bill`) already exist. Insert it using the data insert tool.

### 2. Add tooltip/toast for disabled features (`src/components/QuickActions.tsx`)

When a user taps a greyed-out (globally disabled) feature, show a more informative toast message explaining the feature is temporarily unavailable and maintained by the system. Update both the main grid `handleAction` and the `handleMoreService` handler:

- Change the generic `toast.error` to include a descriptive message like: `"${label} is temporarily unavailable. This feature has been disabled by the system. Please try again later."`
- Use `toast.info` with a custom icon (Ban/AlertCircle) for a friendlier UX
- Also handle feature-locked scenarios with reason text if available (e.g., `lockStatus.reason`)

### Files Modified
- **Data insert**: Add `refer` toggle row to `global_feature_toggles`
- `src/components/QuickActions.tsx` — enhanced disabled feature messages


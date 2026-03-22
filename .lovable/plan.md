

## Add "Hide Feature" Mode to Admin Global Toggles

### Summary
Currently, disabled features appear greyed out with 50% opacity. This adds a third state: **hidden**, which completely removes the feature from the user app (not visible at all).

### Database Change
Add a `visibility` column to `global_feature_toggles`:

```sql
ALTER TABLE public.global_feature_toggles
ADD COLUMN visibility text NOT NULL DEFAULT 'visible';
-- Values: 'visible' (normal), 'disabled' (greyed out), 'hidden' (completely removed)
```

### Hook Changes (`src/hooks/use-global-toggles.ts`)
- Add `isHidden(featureKey)` function that returns `true` when `visibility = 'hidden'`
- Update `isDisabled` to also return `true` when `visibility = 'disabled'`
- Expose `visibility` in the toggle data

### User App Changes (`src/components/QuickActions.tsx`)
- **Main grid actions**: Filter out actions where `isHidden(featureKey)` is true (completely remove from DOM)
- **More services section**: Filter out hidden services from `visibleMoreServices`
- Keep existing greyed-out behavior for `isDisabled` (not hidden)

### More Sheet (`src/components/MoreSheet.tsx`)
- Filter out items where `isHidden` returns true

### Admin UI Changes (`src/components/admin/AdminGlobalToggles.tsx`)
- Replace the simple on/off Switch with a 3-state control:
  - **Visible** (green) — feature is live
  - **Disabled** (yellow) — greyed out, shows toast on tap
  - **Hidden** (red) — completely removed from user app
- Use a small segmented Select or 3-dot toggle per feature row
- Update toggle mutation to set `visibility` instead of just `is_enabled`
- Keep `is_enabled` in sync: `visible` → enabled, `disabled`/`hidden` → not enabled (backward compatibility)

### Files Modified
1. **Migration** — add `visibility` column
2. `src/hooks/use-global-toggles.ts` — add `isHidden()` 
3. `src/components/QuickActions.tsx` — filter hidden features from grid and more section
4. `src/components/MoreSheet.tsx` — filter hidden features
5. `src/components/admin/AdminGlobalToggles.tsx` — 3-state visibility control per toggle
6. `src/components/FeatureGuard.tsx` — block hidden features too




# Fix Feature Unlock Dropdown — Show Only Truly Missing Features

## Problem
The current filter on line 130 excludes ALL globally visible features. But some globally visible features are **hidden from specific users** via badge group overrides (e.g. "New" badge hides `account_icon_size`, `account_live_chat`, etc.). These should appear in the dropdown since the user doesn't actually have them.

The logic should mirror the same resolution hierarchy used by `useGlobalToggles`: **user override > badge group override > global toggle**.

## Fix in `AdminUserPerformanceTracker.tsx`

Replace the filtering logic in `loadAvailableFeatures` (lines 127-134) with resolved visibility logic:

1. For each feature (after excluding role prefixes):
   - Check if the user has a **user-specific override** → use that visibility
   - Else check if the user's **badge group** has an override → use that visibility
   - Else use the **global toggle** visibility (is_enabled + visibility column)
2. Only show features where the **resolved visibility is `hidden` or `disabled`** — these are the ones the user doesn't have

```
// For each feature, resolve effective visibility:
for each feature in allFeatures (excluding role prefixes):
  resolved = "visible" // default
  
  // Check user-specific override first
  if userOverrides has this feature → resolved = that visibility
  // Else check badge group override
  else if badgeGroupOverrides has this feature for user's badge → resolved = that visibility
  // Else use global
  else → resolved = global toggle (is_enabled=true & visibility=visible → "visible", is_enabled=false → "disabled")

  if resolved === "hidden" or resolved === "disabled" → include in dropdown
```

This means features like `account_icon_size` that are globally `visible` but hidden via the "New" badge override **will correctly appear** in the dropdown for "New" badge users.

## Files Changed
- `src/components/admin/AdminUserPerformanceTracker.tsx` — Rewrite filtering in `loadAvailableFeatures` to resolve per-feature visibility using the override hierarchy


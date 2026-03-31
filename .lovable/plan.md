

# Fix Feature Unlock Dropdown — Use Resolved Visibility

## Problem
The filter excludes all globally visible features (line 134), but many features ARE globally visible yet **hidden for specific badge groups** (e.g., "New" users have `account_icon_size`, `account_grid_layout`, `account_compact_mode`, `account_become_merchant`, `account_live_chat`, `account_onboarding` hidden via badge overrides). These should appear in the dropdown because the user doesn't actually have them.

## Fix
Replace the current filtering logic with **resolved visibility calculation** matching the same priority as `useGlobalToggles`:

```
For each feature (after prefix exclusion):
  1. Check user-specific override → if 'visible', skip (already has it)
  2. Check badge group override → if 'visible', skip; if 'hidden'/'disabled', KEEP (user doesn't have it)
  3. Fall back to global toggle → if enabled+visible, skip (default access)
  4. If global is disabled/hidden → KEEP (user doesn't have it)
```

The key change: a feature that is globally visible but **overridden to hidden/disabled by the user's badge group** should appear in the dropdown. Currently line 134 skips it because it only checks the global state.

## Implementation
In `loadAvailableFeatures`, replace the triple filter (lines 126-137) with resolved visibility logic:

```typescript
const filtered = (allFeatures ?? [])
  .filter(f => !EXCLUDED_PREFIXES.some(p => f.feature_key.startsWith(p)))
  .filter(f => {
    // Resolve visibility: user override > badge override > global
    // 1. User-specific override (must be visible for ALL selected users)
    if (userVisibleKeys.has(f.feature_key)) return false;
    
    // 2. Badge group override
    const badgeOverride = (groupOverrides ?? []).find(
      o => o.feature_key === f.feature_key
    );
    if (badgeOverride) {
      // Badge says visible → user has it → skip
      // Badge says hidden/disabled → user doesn't have it → keep
      return badgeOverride.visibility !== "visible";
    }
    
    // 3. Global default
    const globallyVisible = f.is_enabled && (f.visibility === "visible" || !f.visibility);
    return !globallyVisible; // if globally visible, user has it; otherwise keep
  });
```

## File Changed
- `src/components/admin/AdminUserPerformanceTracker.tsx` — Fix filtering in `loadAvailableFeatures` (lines 126-137)


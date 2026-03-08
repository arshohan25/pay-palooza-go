

## Plan: Grayscale Icons for Disabled Features + Extended Toggle Coverage

### What Changes

When an admin turns OFF a feature toggle, the corresponding quick action icon on the home screen will visually change to **grayscale (black and white)** with reduced opacity, clearly showing users the feature is unavailable.

Additionally, extend the `FEATURE_MAP` in `QuickActions.tsx` to cover all main features so every quick action can be individually toggled.

### 1. Extend Feature Mapping (`src/components/QuickActions.tsx`)

Update `FEATURE_MAP` to cover all quick actions including those currently missing:

```
bank → bank_transfer
refer → refer
savings → savings
```

Also extend `moreServices` items with feature keys so they can also be toggled.

### 2. Apply Grayscale Filter When Disabled (`src/components/QuickActions.tsx`)

For each action button, when `isGlobalOff` is true:
- Apply CSS `filter: grayscale(1)` to the icon container, turning colors to black and white
- Reduce opacity to ~50%
- Keep the lock badge for user-specific locks, but use grayscale for global toggles

Changes to the icon container `motion.div`:
```tsx
style={{
  width: 56, height: 56,
  background: action.bgStyle,
  outline: action.ringStyle,
  filter: isGlobalOff ? "grayscale(1)" : "none",
  opacity: isGlobalOff ? 0.5 : 1,
}}
```

Also apply the same grayscale treatment to the label text when disabled.

### 3. Apply to "More Services" Section

For `moreServices` items, add a feature key mapping and apply the same grayscale effect when a feature is globally disabled.

### Files Modified
- `src/components/QuickActions.tsx` — extend `FEATURE_MAP`, apply `grayscale(1)` filter + opacity when globally disabled


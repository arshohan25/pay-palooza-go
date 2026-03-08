

## Fix: MerchantApiTab Not Showing Generated Key (Rendering Issue)

### Root Cause
The API key generation works at the database level (confirmed via network logs: POST returns 201). The problem is a **React rendering issue**: `AnimatePresence` in `MerchantDashboard` is passing a ref to `MerchantApiTab`, which is a function component that doesn't use `React.forwardRef()`. This causes the console warning and can prevent proper re-renders after state changes like `setShowNewSecret`.

### Fix

**1. Wrap `MerchantApiTab` with `React.forwardRef`** in `src/components/MerchantApiTab.tsx`
- Change the component to use `forwardRef` so `AnimatePresence`/`motion.div` can properly manage it
- This resolves the ref warning and ensures state updates (showing the secret key card) trigger proper re-renders

**2. Similarly wrap `MerchantAnalyticsTab`** (same issue from console logs)

### Files to Modify

| File | Change |
|------|--------|
| `src/components/MerchantApiTab.tsx` | Wrap with `React.forwardRef` |
| `src/components/MerchantAnalyticsTab.tsx` | Wrap with `React.forwardRef` |

### Alternative (simpler)
If `forwardRef` isn't the issue, we can also add a `key` prop on the `motion.div` wrapping the tab content in `MerchantDashboard.tsx` to force re-mount, ensuring the component re-renders fresh when switching to the API tab. This is a one-line change.

Both approaches are small, safe fixes.


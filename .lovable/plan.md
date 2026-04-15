

# Fix Gold Holdings Persistence + Add One-Click Sell

## Problem
1. **Gold disappears after refresh**: `loadGoldHoldings` depends on both `user` and `goldKarat` in its `useCallback`. On page refresh, `user` resolves as `null` initially (auth restoring from storage), causing `loadGoldHoldings` to return early. The data only loads for the "active" karat, meaning switching karats also loses the other karat's data.
2. **No quick sell option**: User has to navigate through multiple steps to sell gold.

## Changes

### File: `src/components/SavingsFlow.tsx`

**Fix 1 — Store both karat holdings and derive the active one**
- Change `goldHolding` state to store BOTH 22k and 24k holdings (e.g., `goldHoldings22k` and `goldHoldings24k`, or a map).
- Remove `goldKarat` from the `loadGoldHoldings` dependency — load ALL holdings regardless of selected karat, then derive the active display from state.
- This prevents data loss when switching karats and ensures the overview card always shows correct totals.

**Fix 2 — Re-fetch when user becomes available**
- Add a separate `useEffect` that watches `user` and calls `loadGoldHoldings()` when user transitions from null to a valid user object — ensuring auth restoration triggers a data load.

**Fix 3 — One-click sell buttons on Gold portfolio**
- Add "Sell All" and "Sell Half" quick-action buttons directly on the gold portfolio card (next to or below the existing Buy/Sell buttons).
- "Sell All" pre-fills `goldGrams` with the user's full holding and jumps to the PIN confirmation step.
- "Sell Half" pre-fills with half the holding.
- Both buttons skip the manual gram entry step, going straight to confirm → PIN → execute.

### Summary
- 1 file changed: `src/components/SavingsFlow.tsx`
- Gold data will persist across refreshes by fixing the auth timing and karat dependency issues
- One-click "Sell All" / "Sell Half" buttons added to gold portfolio view


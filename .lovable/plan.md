

## Changes

### 1. Remove "Count" chip from Transaction History header
**File: `src/pages/TransactionHistory.tsx`** (lines 220-235)

Remove the 4th chip (`count`) from the summary grid and change from `grid-cols-4` to `grid-cols-3`.

### 2. Fix ShareReceiptSheet forwardRef warning
**File: `src/components/ShareReceiptSheet.tsx`**

The component uses `motion.button` and `motion.div` with `AnimatePresence` which triggers forwardRef warnings in newer React/framer-motion versions. Wrap inner `motion.span` elements inside `AnimatePresence` with `React.forwardRef` or convert the component to use `forwardRef`. The simplest fix: wrap the component export with `React.forwardRef` and ensure inner animated elements don't trigger the warning by using `motion` components correctly.

| File | Change |
|------|--------|
| `src/pages/TransactionHistory.tsx` | Remove count chip, change grid to 3-col |
| `src/components/ShareReceiptSheet.tsx` | Fix forwardRef warning |


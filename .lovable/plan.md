

## Move Search Bar into Hero & Lock Summary to Current Month

### Problem
1. The search bar sits below the hero card — user wants it inside the hero header area (between the title row and the summary chips).
2. The Money In / Money Out / Fees summary chips currently reflect whatever filters are active. User wants them to always show **current month totals only**, regardless of search, category, or date filters.

### Changes

**File: `src/pages/TransactionHistory.tsx`**

1. **Compute month-fixed totals** — add a new `useMemo` that filters `allTransactions` to current month only (using `startOfMonth` / `endOfDay(new Date())`), then computes `monthIn`, `monthOut`, `monthFees`, `monthCommission`. These replace `totalIn`/`totalOut`/`totalFees`/`totalCommission` in the summary chips.

2. **Move search bar into the hero** — relocate the search `<Input>` block (currently at ~line 302-321) into the hero `<div>` between the title row and the summary grid (~line 251). Restyle the input to match the hero context (glass background, white text, white placeholder).

3. **Summary chips use month-fixed values** — change the 3 summary chip values from `totalIn`/`totalOut`/`totalFees` to `monthIn`/`monthOut`/`monthFees`.

4. **Fee/Commission breakdowns unchanged** — these still use `filtered` data so they respond to user filters as before.

### Files touched
- `src/pages/TransactionHistory.tsx`


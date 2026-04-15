

# Fix Investment Return Percentages to 2%–6% Range

## Problem
Current `STRATEGY_RETURNS` has unrealistically high percentages (6%–24%). User wants all returns capped within **2%–6%** range, varying by strategy, frequency, and duration. Estimated profit must be calculated based on the actual selected amount × frequency × duration.

## Changes (1 file)

### `src/components/SavingsFlow.tsx`

**1. Update `STRATEGY_RETURNS` table** — realistic 2%–6% range:

```
gold:   { 6: 2.0, 12: 2.5, 24: 3.0, 36: 3.5, 60: 4.0, 120: 4.5 }
mixed:  { 6: 2.5, 12: 3.0, 24: 3.5, 36: 4.0, 60: 4.5, 120: 5.0 }
stocks: { 6: 3.0, 12: 3.5, 24: 4.0, 36: 4.5, 60: 5.0, 120: 6.0 }
```

**2. Add frequency multiplier** — higher frequency = slight bonus (daily savers get rewarded):

| Frequency | Bonus |
|-----------|-------|
| Daily     | +0.5% |
| Weekly    | +0.25% |
| Monthly   | +0.0% |

The `getEstReturn` function will accept frequency and add the bonus to the base rate (capped at 6%).

**3. Profit calculation stays the same** — `calcEstimatedProfit` already uses total deposits (amount × frequency × duration) and the return percentage correctly. The only fix needed is feeding it the corrected percentages.

**4. Update strategy card display** — show the frequency-adjusted percentage on each strategy card instead of only duration-based.


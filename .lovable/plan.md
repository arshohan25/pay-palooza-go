

# Show Return Range Instead of Single Percentage on Strategy Cards

## Problem
Strategy cards currently display a single computed percentage like "~2.5%" based on selected duration. User wants each strategy to show its full **range** (min–max across all durations), e.g., "~2–4.5%".

## Changes (1 file: `src/components/SavingsFlow.tsx`)

### 1. Add a helper to compute min–max range per strategy
Create a small function that extracts the lowest and highest values from `STRATEGY_RETURNS[key]` (including frequency bonus):
- Gold: `~2–5%`
- Mixed: `~2.5–5.5%`  
- Stocks: `~3–6%`

### 2. Update strategy card display (line ~770)
Replace:
```
~{getEstReturn(strat.key, selectedDuration.months, autoFreq)}%
```
With the range string, e.g.:
```
~{min}–{max}%
```

This shows the full earning potential regardless of which duration is currently selected.


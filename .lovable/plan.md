

# Update Gold Prices to Real Market Rates

## Problem
The gold prices in the Gold Investment tab are using outdated mock values (22K: ৳9,850/g, 24K: ৳10,750/g). Current real market prices in Bangladesh (April 2026) are significantly higher.

## Real Prices (source: goldrate24.com, BAJUS rates)
- **22K Gold**: ~৳16,200/gram
- **24K Gold**: ~৳19,500/gram

## Changes

### File: `src/components/SavingsFlow.tsx`
1. Update `MOCK_GOLD_PRICE` from `9850` → `16200`
2. Update `MOCK_GOLD_24K_PRICE` from `10750` → `19500`

Also update the "Physical Gold Backed" badge text — the user highlighted it in the screenshot, likely wants it changed to something like "**BAJUS Certified**" or "**BAJUS Rate**" to indicate real pricing source.

### Summary
- 2 constant value changes in one file
- All dependent calculations (buy/sell cost, portfolio value, profit) will automatically use the new prices


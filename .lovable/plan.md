

## Recalculate Agent Commission for Existing Transactions

### Current State
There are **10 cashin/cashout transactions** with incorrect commission values:
- Some have `commission = 0` (cashin transactions never had commission set)
- Some have inflated values like `৳50` on `৳5,000` (1% instead of 0.49%)
- Current total: **৳280** → Correct total should be: **৳490**

### Plan

**Single database UPDATE** using the data insert tool:

```sql
UPDATE transactions
SET commission = ROUND(ABS(amount) * 0.0049, 2)
WHERE type IN ('cashin', 'cashout');
```

This will recalculate all 10 records to use the correct **0.49%** rate. For example:
- ৳5,000 → ৳24.50 (was ৳50)
- ৳10,000 → ৳49.00 (was ৳0)
- ৳15,000 → ৳73.50 (was ৳150)
- ৳20,000 → ৳98.00 (was ৳0)

No code changes needed — this is a data-only fix.

**Files to edit:** None (database data update only)


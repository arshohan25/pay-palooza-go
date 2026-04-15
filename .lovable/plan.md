

# Fix "UPDATE requires a WHERE clause" + PIN Reset

## Problem 1: SQL Error
All 4 investment RPCs (`buy_gold`, `sell_gold`, `buy_stock`, `sell_stock`) have this bug in the treasury credit section:
```sql
UPDATE platform_treasury SET balance = balance + v_fee ... updated_at = now();
-- Missing: WHERE id = v_treasury.id
```
PostgreSQL rejects the UPDATE without a WHERE clause, causing the entire transaction to fail with "UPDATE requires a WHERE clause".

## Problem 2: PIN Not Clearing on Error
When the RPC fails (due to bug #1), the `catch` block sets the error message but does NOT clear the PIN input. `setPin("")` only runs in the success path. The user is stuck with a filled PIN and an error message.

## Fix

### 1. Database Migration — Add WHERE clause to all 4 RPCs
Recreate `buy_gold`, `sell_gold`, `buy_stock`, `sell_stock` with the corrected line:
```sql
UPDATE platform_treasury SET ... WHERE id = v_treasury.id;
```
This is the same one-line fix applied to each of the 4 RPCs.

### 2. Frontend — `src/components/SavingsFlow.tsx`
In `handleBuyGold`, `handleSellGold`, `handleBuyStock`, `handleSellStock`: add `setPin("")` in the `catch` block so the PIN clears on any error, allowing the user to retry.

### Summary
- 1 migration (fix WHERE clause in 4 RPCs)
- 1 file edit (`SavingsFlow.tsx` — clear PIN on error in 4 handlers)


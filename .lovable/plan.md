

# Fix: DPS/Goal Deposits Not Appearing in Transaction History

## Problem
Goal deposits (via `savings_deposit` RPC) and DPS auto-installments (via `process-auto-save` edge function) deduct wallet balance but never insert a record into the `transactions` table. This means these operations are invisible in the user's transaction history.

## Root Cause
1. **`savings_deposit` RPC** -- deducts from `profiles.balance`, inserts into `savings_deposits`, but skips `transactions`
2. **`process-auto-save` edge function** -- same pattern: deducts balance, inserts into `savings_deposits`, no `transactions` record
3. **DPS 1st installment** (client-side) -- calls `recordTransaction()` so it DOES appear, but uses type `"payment"` which is generic

## Changes

### 1. Update `savings_deposit` RPC (DB migration)
Add a transaction record insert after the balance deduction:
```sql
INSERT INTO transactions (user_id, type, amount, fee, description, reference, status, balance_after, short_id)
VALUES (v_user_id, 'payment', p_amount, 0,
  'Savings Goal: ' || v_goal.name,
  'GOAL-DEP-' || substring(gen_random_uuid()::text, 1, 8),
  'completed', v_new_balance,
  upper(substring(gen_random_uuid()::text, 1, 12)));
```

### 2. Update `process-auto-save` edge function
After the successful payment block (line ~150), insert a transaction record:
```typescript
await supabase.from("transactions").insert({
  user_id: schedule.user_id,
  type: "payment",
  amount: schedule.amount,
  fee: 0,
  description: `DPS Installment: ${goal.name} (#${(schedule.total_paid ?? 0) + 1})`,
  reference: `DPS-INST-${schedule.id.substring(0, 8)}`,
  status: "completed",
  balance_after: newBalance,
});
```

### 3. Update client-side DPS 1st installment description (SavingsFlow.tsx ~line 450)
Change `recordTransaction` description from `DPS 1st installment (weekly)` to include the plan/goal name for consistency.

## Result
All savings operations -- manual goal deposits, DPS 1st installment, and auto-collected installments -- will appear in the transaction history with clear descriptions like "Savings Goal: Dream Bike" or "DPS Installment: Dream Bike (#3)".


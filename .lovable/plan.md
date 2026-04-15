

# Deduct Processing Fee at Approval, Disburse Net Amount

## Problem
Currently `disburse_loan` adds the full loan amount to user balance. The 3% processing fee should be deducted immediately when the loan is approved, and only the net amount (loan - fee) should be credited to the user's balance.

## Changes

### 1. Update `disburse_loan` RPC (new migration)

Replace the current logic with:

```sql
v_fee := v_loan.amount * 0.03;          -- 3% processing fee
v_net := v_loan.amount - v_fee;         -- net disbursement

UPDATE profiles SET balance = balance + v_net WHERE user_id = v_loan.user_id;

-- Transaction 1: Fee deduction record
INSERT INTO transactions (...) VALUES
  (..., 'payment', v_fee, 'Loan Processing Fee (3%)', ...);

-- Transaction 2: Net disbursement record  
INSERT INTO transactions (...) VALUES
  (..., 'addmoney', v_net, 'Qard Hasan Disbursement (after fee)', ...);
```

This creates two transaction records: one for the fee and one for the net credit, both visible in history.

### 2. Update `repay_loan` RPC
Repayment should only require the original loan amount (not amount + fee, since fee was already deducted at disbursement). Update `v_total` to use `v_loan.amount` instead of `v_loan.emi_amount`.

### 3. No frontend changes needed
The admin panel already calls `disburse_loan` RPC — the fee logic is entirely server-side.


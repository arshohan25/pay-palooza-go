

## Connect Add Money, Pay Bill, and Payment flows to the database

### What changes
Three transaction flows currently use the old client-only `addBalance`/`deductBalance` functions. They need to be updated to use `recordTransaction` from `balanceStore`, which writes to both the `profiles` and `transactions` tables in the database.

### Files to modify

**1. `src/components/AddMoneyFlow.tsx`**
- Replace `import { addBalance }` with `import { recordTransaction }`
- In `handlePinConfirm`, replace `addBalance(addAmt)` with:
  ```typescript
  await recordTransaction({
    type: "addmoney",
    amount: addAmt,
    fee: 0,
    description: source === "bank" ? `Bank Transfer via ${bank?.name}` : "Card Payment",
    reference: txnId.current,
  });
  ```
- Make `handlePinConfirm` async

**2. `src/components/PayBillFlow.tsx`**
- Replace `import { deductBalance }` with `import { recordTransaction }`
- In `handlePinConfirm`, replace `deductBalance(dueAmt)` with:
  ```typescript
  await recordTransaction({
    type: "paybill",
    amount: dueAmt,
    fee: 0,
    recipientName: `${provider?.name} - ${billType?.name}`,
    description: `${billType?.name} bill - ${provider?.name} (${accountNo})`,
    reference: txnId.current,
  });
  ```
- Make `handlePinConfirm` async

**3. `src/components/PaymentFlow.tsx`**
- Replace `import { deductBalance }` with `import { recordTransaction }`
- In `handlePinConfirm`, replace `deductBalance(amtVal)` with:
  ```typescript
  await recordTransaction({
    type: "payment",
    amount: amtVal,
    fee: 0,
    recipientName: merchant?.name,
    description: note || `Payment to ${merchant?.name}`,
    reference: txnId.current,
  });
  ```
- Make `handlePinConfirm` async

### Technical notes
- The `recordTransaction` function already handles both the balance update in `profiles` and the transaction insert in `transactions`, plus optimistic local state updates and listener notifications.
- No database schema changes are needed -- the `txn_type` enum already includes `addmoney`, `paybill`, and `payment`.
- The pattern exactly matches what was done for SendMoneyFlow, CashOutFlow, and MobileRechargeFlow.

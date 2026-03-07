

## Plan: Fix Fee Display in Transaction History Receipt

### Problem
The transaction detail receipt shows the fee breakdown incorrectly. For a ৳50,000 send with ৳3 fee, it displays:
- **Current**: `৳49,997 + ৳3 fee` (implies fee taken from amount, total = 50,000)
- **Actual**: The RPC deducted ৳50,003 from balance (amount + fee separately)

Line 586 in `TransactionHistory.tsx` calculates `amount - fee + fee` which is mathematically wrong — the stored `amount` field already represents the principal, not principal+fee.

### Fix
Update the fee breakdown text on line 586 to show:
- `৳50,000 + ৳3 fee` (i.e., display the amount as-is, then show fee separately)
- Clarify that fee was charged from balance

**Before:**
```tsx
৳{(Math.abs(selectedTx.amount) - selectedTx.fee).toLocaleString()} + ৳{selectedTx.fee.toLocaleString()} fee
```

**After:**
```tsx
৳{Math.abs(selectedTx.amount).toLocaleString()} + ৳{selectedTx.fee.toLocaleString()} fee (from balance)
```

For debit transactions (send, cashout, etc.), the total wallet deduction was `amount + fee`. The display should reflect that the fee is an additional charge from balance, not subtracted from the amount.

### File Modified
- `src/pages/TransactionHistory.tsx` — line 586


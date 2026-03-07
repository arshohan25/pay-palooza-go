

## Plan: Remove Fee from Transaction List Row

Remove the inline "Fee: ৳X" label from the transaction list rows while keeping the fee visible in the detail sheet and receipt.

### Change

**File: `src/pages/TransactionHistory.tsx`** (lines 432-434)

Delete these 3 lines:
```tsx
{tx.fee > 0 && (
  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">Fee: ৳{tx.fee.toLocaleString()}</p>
)}
```

Fee will still be visible in the transaction detail sheet and shared receipts.


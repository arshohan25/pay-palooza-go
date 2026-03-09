

## Remove Inline Fee Label from Transaction History Rows

The amber "Fee: ৳3" text displayed below the date on each transaction row in `src/pages/TransactionHistory.tsx` (lines 474-476) will be removed. The fee tooltip icon on the right side will remain.

### Change

**`src/pages/TransactionHistory.tsx`** — Delete lines 474-476 (the inline `Fee: ৳{fee}` span below the date).


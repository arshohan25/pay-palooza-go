## Plan: Show Transaction Fees in Transaction History

### Problem

The transaction list and detail sheet currently only show the transaction amount. The fee charged on each transaction is available in the database (`fee` column) but is stripped during the mapping from `DbTransaction` to the local `Transaction` type, so it never appears in the UI.

### Changes

**File: `src/pages/TransactionHistory.tsx**`

1. **Add `fee` to the `Transaction` interface** (line 27-35) — add `fee: number` field.
2. **Pass `fee` through in the mapping** (lines 98-120) — include `fee: t.fee` when constructing each Transaction object.
3. **Show fee in the transaction list row** (lines 418-428) — when `tx.fee > 0`, display a small "Fee: ৳X" label below the detail text, styled in muted/amber text.
4. **Show fee in the detail sheet** (lines 518-543) — add a "Charge / Fee" detail row (with a `Coins` icon) between "Description" and "Date & Time", only when fee > 0.
5. **Update the "Total Amount" highlight** (lines 546-551) — show both the base amount and the fee breakdown (e.g., "৳500 + ৳5 fee") when fee > 0.
6. **Include fee in the Share Receipt rows** (lines 586-593) — add a "Fee" row to the receipt data when fee > Free.

### No database or backend changes required.
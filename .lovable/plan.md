

## Merchant Dashboard: Rename, Fee Display & Transaction Details

### Changes in `src/pages/MerchantDashboard.tsx`

**1. Rename "Recent Payments" → "Recent Activity" & "{count} total" → "See All" (lines 753-754)**
- Change heading text to "Recent Activity"
- Replace `{paymentTxns.length} total` span with a clickable "See All" button that navigates to the transactions tab (`setActiveTab("transactions")`)

**2. Add fee info to TxnTab transaction rows (lines 1240-1262)**
- Show fee as small amber text below the date when `tx.fee > 0` (e.g. `Fee: ৳{fee}`)
- Add a fee tooltip icon on the row similar to the main transaction history

**3. Add transaction detail sheet to TxnTab**
- Add a `selectedTx` state to `TxnTab`
- Make each row clickable to open a detail bottom sheet
- Detail sheet shows: amount, customer name, reference, date/time, fee breakdown (Principal + Fee = Total), status
- For transactions with fees: show the detailed breakdown card (Principal, Fee, Total Deducted) matching the style from the main TransactionHistory
- Include copy-to-clipboard for the transaction reference

| Area | Change |
|------|--------|
| Overview section (line 753-754) | "Recent Activity" + "See All" button |
| TxnTab rows (line 1240-1262) | Fee display per row |
| TxnTab (new) | Transaction detail bottom sheet with fee breakdown |


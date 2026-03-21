
## Fix Merchant Overview Card View — Show Flow-Aware Activity There Too

### What I found
The full History tab was updated, but the merchant overview card view was not.

In `src/pages/MerchantDashboard.tsx`:
- `MerchOverview` still receives `paymentTxns` only
- the “Recent Activity” card still renders only payment rows
- those rows are plain `div`s, so there is no tap-to-open detail sheet
- the card still uses generic payment-only labels instead of flow-aware headlines

That is why the card view is “still not showing” the new behavior.

### Implementation plan

1. **Pass all transactions into the overview recent-activity section**
   - Update `MerchOverview` props so it can receive full `txns` instead of only `paymentTxns` for the card list
   - Keep `paymentTxns` only where payment-only metrics are actually needed (revenue, MDR, customer analytics)

2. **Replace the current “Recent Activity” card list**
   - Stop using `paymentTxns.slice(0, 5)`
   - Render the latest 5 items from the full transaction list
   - Reuse the same flow-aware logic already added for the History tab:
     - `MERCHANT_INCOMING_TYPES`
     - `MERCH_TX_CONFIG`
     - `getMerchTxHeadline(tx)`

3. **Make overview card rows tappable**
   - Convert each recent activity row into a button
   - Add a local `selectedTx` state inside `MerchOverview`
   - Open a bottom detail sheet when a row is tapped

4. **Use the same flow-aware content in overview card view**
   - Incoming examples:
     - `Received Payment from ...`
     - `Received from ...`
     - `Added Money`
     - `Cash In`
   - Outgoing examples:
     - `Send Money to ...`
     - `Cash Out`
     - `Bank Transfer to ...`
     - `Recharge ...`
     - `Bill Pay — ...`
   - Show correct icon, color, and sign for every flow

5. **Unify the detail sheet behavior**
   - Reuse the same transaction-detail presentation as the History tab:
     - transaction ID / short ID
     - type label
     - from/to info
     - phone/reference/date
     - fee breakdown
     - balance after
   - Ensure outgoing amounts are not shown as green `+`

6. **Small cleanup**
   - Rename the card from payment-specific rendering to true activity rendering
   - Add an accessible description to the sheet/dialog content to remove the current dialog warning in console

### Files to update
- `src/pages/MerchantDashboard.tsx`

### Expected result
After this change, the merchant overview card view will:
- show all recent transaction flows, not only payments
- display the correct headline for each flow
- open transaction details on tap
- match the History tab behavior visually and functionally

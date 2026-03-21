## Fix Merchant Transaction History — Show All Types with Flow-Aware Headlines

### Problems

1. **Only payment transactions shown** — `TxnTab` receives `paymentTxns` which is filtered to `type === "payment"` only. The merchant should see ALL their transactions (payments received, cash outs, send money, add money, donations, etc.)
2. **No detail sheet on tap** — The detail sheet exists but headlines are generic ("Customer", amount always green "+"). Outgoing transactions show wrong sign/color.
3. **Headlines don't match flows** — Every transaction shows the same generic format instead of flow-specific labels like "Received Payment from...", "Cash Out", "Send Money to...", etc.

### Changes to `src/pages/MerchantDashboard.tsx`

**1. Pass all `txns` instead of `paymentTxns` to TxnTab (line 439)**

```
txns={txns}  // was: txns={paymentTxns}
```

**2. Add `short_id` to `TxnRow` interface** (line 60-73) for display in details.

**3. Redesign `TxnTab` (lines 1235-1391)** with flow-aware display:

- **Flow-aware headline function** that maps transaction type to contextual labels:
  - `payment` → "Received Payment/Payment" (incoming for merchant out going for user, green)
  - `receive` → "Received from {name}" (incoming, green)
  - `addmoney` → "Added Money" (incoming, green)
  - `cashin` → "Cash In" (incoming for user out going for agent, green)  
  - `send` → "Sent to {name}" (outgoing, red/foreground)
  - `cashout` → "Cash Out/Cashout Recieved" (outgoing for user incoming for agent, orange)
  - `banktransfer` → "Bank Transfer" (outgoing, blue)
  - `recharge` → "Mobile Recharge" (outgoing, cyan)
  - `paybill` → "Bill Payment" (outgoing, amber)
- **Per-type icon and color** — each row gets a distinct icon/bg matching the type (similar to the user `TransactionList` component's `TX_CONFIG`)
- **Amount sign** — incoming types show `+৳` in green, outgoing show `−৳` in foreground/red
- **Detail sheet update** — Use the same flow-aware headline in the detail sheet header. Show `short_id` as Transaction ID with copy button. Show correct amount sign/color.

**4. Update detail sheet rows** to include Transaction ID (short_id), flow-specific type label, and correct amount coloring for debit vs credit.

### Files Modified

- `src/pages/MerchantDashboard.tsx` — TxnRow type, TxnTab component, detail sheet, pass `txns` instead of `paymentTxns`
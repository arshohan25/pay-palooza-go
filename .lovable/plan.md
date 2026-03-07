

## Plan: Replace All Mock Data with Real Transaction Data

### Summary

Five mock data sources remain in `SpendingInsightsPage.tsx`. All will be replaced with real queries against the `transactions` table.

### Mock Data to Replace

| Mock Constant | What it feeds | Replacement |
|---|---|---|
| `TOTAL_SENT` / `TOTAL_RECEIVED` | Sent/Received summary cards + % change | Sum outgoing (send, cashout, payment, recharge, paybill, banktransfer) and incoming (receive, addmoney) for current month + previous month for % delta |
| `BAR_DATA` + `MONTHS` | Monthly stacked bar chart | Group last 6 months of transactions by month and type |
| `DONUT_RAW` | Category donut chart | Aggregate current month's outgoing transactions by type |
| `TOP_MERCHANTS` | Top merchants list | Group current month's payment/recharge transactions by `recipient_name`, sort by total amount descending, take top 5 |

### Changes (single file: `src/pages/SpendingInsightsPage.tsx`)

1. **Remove** all mock constants (`BAR_DATA`, `DONUT_RAW`, `TOP_MERCHANTS`, `TOTAL_SENT`, `TOTAL_RECEIVED`, hardcoded `MONTHS`).

2. **Add state variables**:
   - `insightsLoading` (boolean)
   - `totalSent`, `totalReceived`, `sentDelta`, `receivedDelta` (numbers)
   - `barData` (array of `{ month, Send, CashOut, Payment, Recharge }`)
   - `donutData` (array of `{ key, value, color }`)
   - `topMerchants` (array of `{ name, category, amount, icon }`)
   - `months` (string array derived from data)

3. **Extend the existing `useEffect`** to fetch all completed transactions from the last 6 months in a single query:
   ```ts
   const { data } = await supabase
     .from("transactions")
     .select("type, amount, created_at, recipient_name, description")
     .eq("user_id", session.user.id)
     .eq("status", "completed")
     .gte("created_at", sixMonthsAgo.toISOString());
   ```

4. **Process client-side** (all from the single query result):
   - **Sent/Received**: Filter current month outgoing vs incoming types, sum amounts. Repeat for previous month to compute % delta.
   - **Bar chart**: Bucket by month name, accumulate per-type totals (send → Send, cashout → CashOut, payment → Payment, recharge → Recharge).
   - **Donut**: Same as bar chart but only for the selected active month.
   - **Top merchants**: Filter `payment`/`recharge`/`paybill` types for current month, group by `recipient_name`, sort descending, take top 5. Use a category icon mapping based on transaction type.
   - **Months**: Derive dynamically from the last 6 calendar months.

5. **Set `activeMonth`** to the current month name by default instead of hardcoded "Jan".

6. **Add loading skeleton** to all sections while `insightsLoading` is true.

7. **Update the donut chart** to react to `activeMonth` — when user taps a month in the bar chart header, the donut updates to show that month's category breakdown.

### Data Mapping

```text
Outgoing types: send, cashout, payment, recharge, paybill, banktransfer
Incoming types: receive, addmoney (excluding cashback which is already tracked)

Bar chart categories:
  send + banktransfer → "Send"
  cashout             → "CashOut"
  payment + paybill   → "Payment"
  recharge            → "Recharge"
```

### No database changes required — all data already exists in the `transactions` table.


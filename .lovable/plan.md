

## Remove Percentage Display from Commission, Show Only Flat Amount

The user wants to:
1. Remove the percentage rate (e.g., `(0.485%)`) from commission displays — show only the flat earned amount
2. Ensure commission is accurately calculated as `amount × 0.00485` for cash in/out and `amount × 0.000201` for bill pay

### Changes in `src/pages/TransactionHistory.tsx`

**1. Inline commission text (line 485)**
- Change from: `Commission: ৳{commission} (0.485%)`
- To: `Commission: ৳{commission}` — remove the percentage suffix

**2. Tooltip content (line 503)**
- Same removal of percentage from tooltip text

**3. Detail sheet row (line 614)**
- Remove `@ 0.485%` from the commission earned row value

**4. Detail sheet breakdown card (line 648)**
- Remove `(0.485%)` from "Commission Earned" label

**5. Mobile detail rows (line 735)**
- Remove `@ 0.485%` from commission label

**6. Accurate commission calculation**
- Currently commission comes from the DB (`t.commission`). If the stored value is inaccurate, recalculate client-side using `AGENT_COMMISSION_RATES` as: `Math.round(Math.abs(amount) * rate * 100) / 100`
- Will verify that displayed values match `amount × 0.00485` for cashin/cashout

All ~6 locations where `AGENT_COMMISSION_RATES[...]` is interpolated into display strings will have the percentage reference removed.




## Fix Agent Transaction History: Show Commission Instead of Fee

### Problem
The screenshot shows the agent's transaction history displaying "FEES ৳768.5" in the summary header and "Fee: ৳11.5" tooltips on individual transactions. Agents don't pay fees — they earn **commission**. The summary and per-transaction indicators should reflect this.

### Changes

**File: `src/pages/TransactionHistory.tsx`**

1. **Summary chips (line 220-232)**: When `agentView` is true, replace the "Fees" chip with "Commission" — compute `totalCommission` instead of `totalFees`, show in emerald color instead of amber.

2. **Per-transaction fee tooltip (lines 449-459)**: When `agentView` is true, show commission amount (emerald colored) instead of fee amount (amber). Change the tooltip text from "Fee: ৳X" to "Commission: ৳X" and use the commission value.

3. **Detail sheet fee row (line 552)**: When `agentView`, hide the "Charge / Fee" row (agents don't pay fees) — it's already showing "Commission Earned" conditionally on line 553, which is correct.

4. **Share receipt fee row (line 629)**: Same — when `agentView`, hide fee row, keep commission row.

### Summary of Logic

```
// In summary chips:
agentView ? { label: "Commission", value: totalCommission, color: "text-emerald-300" }
          : { label: "Fees", value: totalFees, color: "text-amber-300" }

// In transaction row tooltip:
agentView ? show commission icon + "Commission: ৳{commission}" in emerald
          : show fee icon + "Fee: ৳{fee}" in amber
```

### Files Changed
| File | Change |
|------|--------|
| `src/pages/TransactionHistory.tsx` | Swap fee displays for commission when `agentView` is true |


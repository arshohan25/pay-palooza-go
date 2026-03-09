

## Add Commission Section to Transaction History & Detail Card

### Changes in `src/pages/TransactionHistory.tsx`

**1. Commission Breakdown Summary (agent view)**
- Add a `CommissionBreakdownSummary` component (similar to `FeeBreakdownSummary`) that shows when `agentView && totalCommission > 0`
- Collapsible card in emerald styling showing commission grouped by transaction type (e.g., "Cash In: ৳50, Cash Out: ৳120, Bill Pay: ৳5")
- Placed at line ~249, right after the hero header, mirroring where `FeeBreakdownSummary` appears for non-agent views

**2. Enhanced Detail Card for Agent View (~lines 625-638)**
- Replace the simple "Total Amount" box with a detailed breakdown card matching the fee breakdown style:
  - Transaction Amount: ৳{amount}
  - Commission Earned: +৳{commission} @ {rate}%
  - Styled in emerald instead of amber
- Keep the existing simple display for transactions with no commission

### Summary

| Area | Change |
|------|--------|
| After hero header | New `CommissionBreakdownSummary` for agent view |
| Detail sheet amount card | Detailed commission breakdown card (emerald styling) |


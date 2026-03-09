

## Add Fee Section to Transaction History

### Changes

**`src/pages/TransactionHistory.tsx`**

1. **Fee breakdown summary card** (after the hero header, before search bar ~line 248):
   - Collapsible card showing total fees grouped by transaction type (e.g. "Send: ৳15, Cash Out: ৳120, Bank Transfer: ৳50")
   - Only shows when `!agentView` and `totalFees > 0`
   - Toggle with a "Fee Breakdown" button/accordion

2. **Fee per transaction row** (~line 444-458):
   - Show fee amount inline below the date for non-agent view when `tx.fee > 0`
   - Small amber text: `Fee: ৳{fee}` next to existing detail line
   - Keep the existing tooltip icon as well

3. **Detailed fee card in detail sheet** (~line 607-628):
   - Replace the simple "Total Amount" box with a detailed breakdown card:
     - Principal: ৳{amount}
     - Fee: ৳{fee} (source label: "from balance" / "from amount")
     - Total Deducted: ৳{amount + fee}
   - For credit transactions (no fee), keep current simple display
   - For agent view, keep commission display as-is

4. **Share receipt fee row** (~line 664-670):
   - Include fee breakdown in receipt: `৳{amount} + ৳{fee} fee`

### Summary

| File | Change |
|------|--------|
| `src/pages/TransactionHistory.tsx` | Add fee breakdown summary, inline fee on rows, expanded fee card in detail sheet, fee in receipt |


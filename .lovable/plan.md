

## Plan: Add Consistent Fee Breakdown to AgentCashIn & AgentB2B Receipts

### Changes

#### 1. AgentCashIn.tsx — Success receipt (lines 97-104)
Currently shows amount and commission but no fee breakdown. Cash In has `fee: 0` (free), so add a structured receipt summary matching the standard format:

Replace the simple text + commission block with a proper breakdown:
- Amount: `৳{amount}`
- Fee: `Free`
- Commission earned: `+৳{commission}`
- Add `৳{amount} + Free` subtitle line for consistency

#### 2. AgentB2B.tsx — Success receipt (lines 92-101)
Currently shows amount text and a simple "Fee charged" box. Replace with consistent format:

- Amount: `৳{amount}`
- Fee: `৳{fee}` or `Free`
- If fee > 0: `৳{amount} + ৳{fee} fee (from balance)` subtitle
- Total: `৳{amount + fee}`

#### 3. AgentB2B.tsx — Confirm step (lines 113-114)
Already has proper fee/total rows. Add the `(from balance)` subtitle when fee > 0 after the fee row for consistency.

### Files Modified (2)
- `src/pages/AgentCashIn.tsx`
- `src/pages/AgentB2B.tsx`


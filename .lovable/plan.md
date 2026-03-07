

## Plan: Align Fee Breakdown in SendMoneyFlow & CashOutFlow Receipts

### Goal
Match the TransactionHistory receipt format: `৳{amount} + ৳{fee} fee (from balance)` — simple, consistent, one-line.

### Current State
- **TransactionHistory**: `৳50,000 + ৳3 fee (from balance)` — clean, consistent
- **SendMoneyFlow receipt** (lines 883-888): Verbose "Fee deducted from" row with complex ternary (`Balance (৳X) + Amount (৳Y)`)
- **CashOutFlow receipt** (lines 944-953): Same verbose pattern with different wording

### Changes

#### 1. SendMoneyFlow.tsx — Success receipt (lines 879-893)
Replace the fee row + fee source row + recipient receives row with the consistent format:
- Fee row: `৳{fee}` or "Free"
- If fee > 0, show: `৳{amount} + ৳{fee} fee (from balance)` as a single subtitle line
- Keep "Recipient Receives" row only when `feeFromAmount > 0` (fee partially/fully from amount)

#### 2. CashOutFlow.tsx — Success receipt (lines 940-957)  
Same update:
- Fee row: `৳{fee}` with label
- Replace verbose "Fee deducted from" row with consistent `৳{amount} + ৳{fee} fee (from balance)` format
- Keep "You Received" row only when `feeFromAmount > 0`

#### 3. Also update confirmation step displays
- **SendMoneyFlow** confirm step (lines 788-793): Align fee source text
- **CashOutFlow** confirm step (lines 850-859): Align fee source text

### Consistent Format Applied
```tsx
// Fee row
<div className="flex justify-between text-muted-foreground">
  <span>Fee</span>
  <span className="text-foreground font-medium">{fee === 0 ? "Free" : `৳${fee}`}</span>
</div>
// Fee source (only when fee > 0)
{fee > 0 && (
  <p className="text-[11px] text-muted-foreground text-right">
    ৳{amount} + ৳{fee} fee ({feeFromBalance >= feeNum ? "from balance" : feeFromBalance > 0 ? "balance + amount" : "from amount"})
  </p>
)}
```

### Files Modified
- `src/components/SendMoneyFlow.tsx` — receipt + confirm step
- `src/components/CashOutFlow.tsx` — receipt + confirm step


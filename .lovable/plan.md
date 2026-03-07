

## Plan: Add Fee Indicator Icon to Transaction List Rows

Replace the removed fee text with a small, subtle icon-only indicator for transactions that have fees.

### Change

**File: `src/pages/TransactionHistory.tsx`**

1. **Import `BadgeDollarSign`** (or `CircleDollarSign`) from `lucide-react` — a compact icon that conveys "fee applied."

2. **Add a tiny fee icon next to the amount** (around line 441) — show a small amber `BadgeDollarSign` icon beside the amount when `tx.fee > 0`. This keeps the UI clean while still signaling that a fee was charged. Users can tap into the detail sheet to see the exact fee.

```tsx
{/* Amount */}
<div className="shrink-0 text-right max-w-[90px]">
  <div className="flex items-center justify-end gap-1">
    {tx.fee > 0 && (
      <BadgeDollarSign size={12} className="text-amber-500/70 dark:text-amber-400/70" />
    )}
    <span className={`text-[13px] font-bold ...`}>
      {isCredit ? "+" : "−"}৳{Math.abs(tx.amount).toLocaleString()}
    </span>
  </div>
</div>
```

One file, minimal change. The icon is 12px, muted amber, and only appears when fee > 0.


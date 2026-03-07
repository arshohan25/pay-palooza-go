

## Plan: Add Cumulative Fees Summary to Transaction History

Add a small summary chip showing total fees paid, integrated into the existing 3-column summary grid in the hero header.

### Change

**File: `src/pages/TransactionHistory.tsx`**

1. **Compute total fees** — add a `useMemo` or inline calculation for total fees from the `filtered` transactions:
```tsx
const totalFees = filtered.reduce((s, t) => s + (t.fee || 0), 0);
```

2. **Expand the summary grid from 3 to 4 columns** (lines 219-230) — change `grid-cols-3` to `grid-cols-4` and add a fourth chip for fees:

```tsx
<div className="grid grid-cols-4 gap-2 w-full">
  {[
    { label: t("moneyIn"),  value: `+৳${totalIn.toLocaleString()}`,  color: "text-green-300" },
    { label: t("moneyOut"), value: `-৳${totalOut.toLocaleString()}`, color: "text-rose-300"  },
    { label: "Fees",        value: `৳${totalFees.toLocaleString()}`, color: "text-amber-300" },
    { label: t("count"),    value: String(filtered.length),          color: "text-white"     },
  ].map(/* existing renderer */)}
</div>
```

The amber color matches the existing fee indicator icon styling. Single file, minimal change.


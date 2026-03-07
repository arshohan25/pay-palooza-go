

## Plan: Add Tooltip to Fee Indicator Icon

### Change

**File: `src/pages/TransactionHistory.tsx`**

1. **Import** `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider` from `@/components/ui/tooltip`.

2. **Wrap the `BadgeDollarSign` icon** (lines 441-443) with Tooltip components:

```tsx
{tx.fee > 0 && (
  <TooltipProvider delayDuration={0}>
    <Tooltip>
      <TooltipTrigger asChild>
        <BadgeDollarSign size={12} className="text-amber-500/70 dark:text-amber-400/70 cursor-help" />
      </TooltipTrigger>
      <TooltipContent side="left" className="text-xs">
        Fee: ৳{tx.fee.toLocaleString()}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)}
```

One file, minimal change. `delayDuration={0}` ensures instant display on hover/tap.


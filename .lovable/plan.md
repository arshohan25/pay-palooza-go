

## Plan: Add Total Commission Summary Badge to Header

The page already has a full "Earnings Summary" card with commission, volume, and counts. The request is to add a prominent **badge** in the header area that highlights total commission earned at a glance.

### Changes

**File: `src/pages/AgentTransactionHistory.tsx`**

1. **Import `Badge`** from `@/components/ui/badge`.

2. **Add a commission badge next to the header title** (line 65-68) — after the "Agent Transactions" title, insert a `Badge` showing `৳{totalCommission}` styled with a green/emerald background to make it stand out as a quick-glance earnings indicator.

```tsx
<div className="flex items-center gap-2">
  <Building2 size={18} className="text-primary" />
  <h1 className="text-base font-bold text-foreground">Agent Transactions</h1>
  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[11px] font-bold">
    ৳{fmt(summary.totalCommission)} earned
  </Badge>
</div>
```

One file, one small addition. No database changes needed.


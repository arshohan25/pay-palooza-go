

## Default to Current Month in Transaction History

### Problem
The Transaction History page loads **all** transactions by default. The user wants it to show only the **current month's** data initially.

### Change

**File: `src/pages/TransactionHistory.tsx`**

Initialize `dateFrom` and `dateTo` state to the current month boundaries instead of `undefined`:

```ts
const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfMonth(new Date()));
const [dateTo, setDateTo]     = useState<Date | undefined>(endOfDay(new Date()));
```

- Import `startOfMonth` from `date-fns` (already using `date-fns`).
- The filter panel (`showFilters`) will start collapsed but the date range is already active, so the summary cards (Money In, Money Out, Fees) and the transaction list will reflect current month only.
- The filter toggle button will show its "active" style (white bg) since `dateFrom` is set.
- "Clear filters" resets to `undefined` (all data) as before.

### Files touched
- `src/pages/TransactionHistory.tsx` — add `startOfMonth` import, change default state for `dateFrom`/`dateTo`.


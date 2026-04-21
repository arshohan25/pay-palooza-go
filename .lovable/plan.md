
## Fix Transaction History: DB-Only Running Month + Visible Search Bar

### What will change

1. **Search bar will be moved above the Money In / Money Out / Fees cards**
   - The search bar will appear immediately under the “Transaction History” title row.
   - Then the 3 amount cards will show below it.
   - This fixes the issue where the search bar is not visible in the marked top area.

2. **Money In / Money Out / Fees will use only running month database data**
   - These cards will not use dummy values.
   - They will not calculate from all-time loaded transactions.
   - They will be calculated from rows fetched from the `transactions` database table for:
     - current logged-in user
     - current month only
     - from first day of current month to now/end of today

3. **Transaction list will also default to running month DB data**
   - The page will request current-month transactions from the database instead of loading all transactions first and filtering in the browser.
   - Search/category filters will apply only within the current-month dataset.

4. **Remove misleading “Clear all = all time” behavior for this page**
   - “Clear filters” will clear search/category filters.
   - It will keep the running-month date boundary so the page does not jump back to all-time data.

### Technical plan

**File: `src/hooks/use-transactions.ts`**

Update `useTransactions` to optionally accept a database date range:

```ts
useTransactions(limit, refreshKey, {
  from: monthStartIso,
  to: monthEndIso,
})
```

Then apply these filters directly to the database query:

```ts
.gte("created_at", from)
.lte("created_at", to)
```

Realtime updates will also stay scoped to the authenticated user and then refetch the current month dataset.

---

**File: `src/pages/TransactionHistory.tsx`**

1. Create fixed running-month boundaries:

```ts
const runningMonthStart = startOfMonth(new Date());
const runningMonthEnd = endOfDay(new Date());
```

2. Pass those boundaries into `useTransactions`, so DB returns only current-month rows:

```ts
const { transactions: dbTxns, loading, refetch } = useTransactions(undefined, undefined, {
  from: runningMonthStart.toISOString(),
  to: runningMonthEnd.toISOString(),
});
```

3. Calculate Money In / Money Out / Fees directly from that DB-backed current-month dataset.

4. Move the search input above the 3 summary cards:

```text
Transaction History title row
Search bar
Money In | Money Out | Fees
```

5. Keep filtering/searching client-side only within the already current-month DB result.

6. Update “Clear filters” so it does not remove the running-month scope.

### Result

The marked top cards will show only current month transaction totals from the database, and the search bar will be visible in the top hero area.


## Plan: Replace Mock Data with Real Transaction Data on Spending Insights Page

### Mock Data to Replace

There are 5 pieces of mock data:

1. **`TOTAL_SENT` / `TOTAL_RECEIVED`** (lines 41-42) — hardcoded summary totals and fake % change
2. **`BAR_DATA`** (lines 17-24) — monthly breakdown by category (last 6 months)
3. **`DONUT_RAW`** (lines 26-31) — current month category breakdown for donut chart
4. **`TOP_MERCHANTS`** (lines 33-39) — top recipients by spend amount
5. **`MONTHS`** (line 15) — hardcoded month labels

### Approach

All data will be fetched from the `transactions` table in a single `useEffect`, querying the user's completed transactions from the last 6 months. The data will be aggregated client-side.

**File: `src/pages/SpendingInsightsPage.tsx`**

#### 1. Sent/Received Summary (replace `TOTAL_SENT`, `TOTAL_RECEIVED`)
- Sum amounts where `type` in (`send`, `cashout`, `payment`, `recharge`, `paybill`) for "sent" (outgoing)
- Sum amounts where `type` in (`receive`, `addmoney`, `cashin`) for "received" (incoming)
- Calculate % change vs previous month by comparing current vs prior month totals

#### 2. Monthly Bar Chart (replace `BAR_DATA`, `MONTHS`)
- Group transactions by month (last 6 months) and by type mapped to chart categories:
  - `send` → Send, `cashout` → CashOut, `payment`/`paybill` → Payment, `recharge` → Recharge
- Generate month labels dynamically from the last 6 calendar months
- Default active month to the current month

#### 3. Donut Chart (replace `DONUT_RAW`)
- Aggregate current month's outgoing transactions by category (same mapping as bar chart)
- Keep the same color scheme

#### 4. Top Recipients (replace `TOP_MERCHANTS`)
- Group outgoing transactions (current month) by `recipient_name`
- Sort by total amount descending, take top 5
- Derive category from transaction `type` and use emoji icons based on type
- If `recipient_name` is null, use `recipient_phone` as fallback

#### 5. Loading State
- Add a `loading` boolean; show skeleton placeholders while data is being fetched

### Data Fetching Strategy

Single query fetching all transactions from 6 months ago to now:
```tsx
const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
const { data } = await supabase
  .from("transactions")
  .select("type, amount, created_at, recipient_name, recipient_phone, status")
  .eq("user_id", session.user.id)
  .eq("status", "completed")
  .gte("created_at", sixMonthsAgo)
  .order("created_at", { ascending: false });
```

All aggregation (monthly grouping, category sums, top recipients, sent/received totals, % change) is done client-side with `useMemo` from the fetched array.

### Files Modified
- `src/pages/SpendingInsightsPage.tsx` — remove all mock constants, add fetch + aggregation logic, wire up computed data to existing chart components




## Plan: Add Monthly Fees Breakdown Chart to Spending Insights

Add a new card below the cashback widget showing a bar chart of fees paid per month, using real transaction data from the database.

### Change

**File: `src/pages/SpendingInsightsPage.tsx`**

1. **Add `LineChart, Line` to the existing recharts imports** (already have `BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer`).

2. **Add fee data fetching** — extend the existing `useEffect` (or add a new one) to query the last 6 months of completed transactions with `fee > 0`, group by month, and compute total fees per month.

3. **Add a new chart card** between the cashback widget and the monthly bar chart (around line 205). It will render:
   - A card titled "Monthly Fees" with a small amber `BadgeDollarSign` icon
   - A summary showing total fees across the period
   - A bar chart (amber-colored bars) with month labels on X-axis and fee amounts on Y-axis
   - Uses the same card styling (`bg-card rounded-3xl border border-border/60 shadow-card`)

### Data Logic
```tsx
// Fetch last 6 months of transactions with fees
const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
const { data } = await supabase
  .from("transactions")
  .select("fee, created_at")
  .eq("user_id", session.user.id)
  .eq("status", "completed")
  .gt("fee", 0)
  .gte("created_at", sixMonthsAgo.toISOString());

// Group by month -> [{ month: "Jan", fees: 450 }, ...]
```

### UI Structure
```tsx
<motion.div className="bg-card rounded-3xl border border-border/60 shadow-card overflow-hidden">
  <div className="px-4 pt-4 pb-2 flex items-center gap-2">
    <BadgeDollarSign size={16} className="text-amber-500" />
    <p className="text-sm font-bold text-foreground">Monthly Fees</p>
    <span className="ml-auto text-xs text-amber-500 font-semibold">
      Total: ৳{totalFees}
    </span>
  </div>
  <div style={{ height: 180 }}>
    <ResponsiveContainer>
      <BarChart data={feeData}>
        <Bar dataKey="fees" fill="hsl(40, 80%, 50%)" radius={[4,4,0,0]} />
        ...
      </BarChart>
    </ResponsiveContainer>
  </div>
</motion.div>
```

One file changed. Real data from the database, consistent styling with existing charts.


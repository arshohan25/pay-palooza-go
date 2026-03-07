

## Plan: Budget vs Actual Spending Comparison Chart

Add a grouped bar chart below the `BudgetManager` component that visually compares budget limits against actual spending for each budgeted category.

### Change

**File: `src/pages/SpendingInsightsPage.tsx`**

1. **Import** `useSpendingBudgets` hook (already have `BudgetManager` imported).

2. **Add a new chart section** after `<BudgetManager />` (after line 208) — a grouped `BarChart` using Recharts (already imported) that shows side-by-side bars for each budgeted category:
   - **Budget** bar (muted/outline style, e.g. `hsl(var(--muted-foreground))`)  
   - **Actual** bar (colored based on overspend: green if under, amber if 70-90%, red if over 90%)

3. **Data source**: Call `useSpendingBudgets()` in the component to get `budgets` and `spending`. Transform into chart data:
   ```tsx
   const budgetChartData = budgets.map(b => ({
     category: categoryLabel(b.category),
     Budget: b.monthly_limit,
     Actual: spending[b.category] || 0,
   }));
   ```

4. **Render**: Only show the chart when `budgets.length > 0`. Card styled consistently with existing sections — rounded-3xl, border, shadow-card. Include a custom tooltip showing both values and percentage used.

### Files Modified
- `src/pages/SpendingInsightsPage.tsx` — add hook call + chart section (~40 lines)


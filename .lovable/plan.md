

## Plan: Add Recurring Budget Feature

The `spending_budgets` table already exists in the database with `category`, `monthly_limit`, and `user_id` columns. It currently has no frontend usage. This plan adds a budget management section to the Spending Insights page that automatically carries over each month (budgets are persistent — they apply every month until changed).

### Database Change

Add a `is_recurring` boolean column (default `true`) and `last_reset_month` text column to `spending_budgets` so the system can track carryover state. This lets users optionally disable recurrence per category.

```sql
ALTER TABLE spending_budgets
  ADD COLUMN is_recurring boolean NOT NULL DEFAULT true,
  ADD COLUMN last_reset_month text;
```

### Frontend Changes

**1. New hook: `src/hooks/use-spending-budgets.ts`**
- CRUD operations on `spending_budgets` table using Supabase client
- Fetch user's budgets, upsert (create/update) a budget for a category, delete a budget
- Compare actual spending from `transactions` table (current month, grouped by type) against each budget's `monthly_limit`
- Expose: `budgets`, `spending`, `loading`, `setBudget`, `removeBudget`

**2. New component: `src/components/BudgetManager.tsx`**
- Renders inside the Spending Insights page as a new card section
- Shows each budget category with:
  - Progress bar (spent / limit) colored green → amber → red as usage increases
  - Percentage used label
  - Edit button (inline input to change limit)
  - Toggle for `is_recurring` (on by default)
  - Delete button
- "Add Budget" button opens a small form: pick category (Send, Cash Out, Payment, Recharge, Bill Pay), set monthly limit
- Categories map to transaction types: `send`, `cashout`, `payment`, `recharge`, `paybill`

**3. Update `src/pages/SpendingInsightsPage.tsx`**
- Import and render `<BudgetManager />` between the cashback widget and the monthly bar chart
- Simple integration — one line addition

### How "Recurring" Works
- Budgets are stored persistently — they apply to every month automatically (no cron needed)
- The hook calculates spending for the **current month** against the stored limit each time
- The `is_recurring` toggle, when turned off, means the budget is treated as a one-time budget; the hook will auto-delete it after the month ends (checked client-side on load)
- No server-side scheduled jobs required — the carryover is implicit by design

### Files Created/Modified
- **Migration**: Add `is_recurring` and `last_reset_month` columns to `spending_budgets`
- **Create**: `src/hooks/use-spending-budgets.ts`
- **Create**: `src/components/BudgetManager.tsx`
- **Edit**: `src/pages/SpendingInsightsPage.tsx` (add one import + render)


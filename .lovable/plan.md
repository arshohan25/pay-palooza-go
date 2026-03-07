

## Plan: Spending Budget/Goal Feature

### Overview
Add a budget management feature that lets users set monthly spending limits per category and track progress on the Insights page. Requires a new database table and UI components.

### 1. Database Migration

Create a `spending_budgets` table:

```sql
CREATE TABLE public.spending_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL,          -- 'total', 'Send', 'CashOut', 'Payment', 'Recharge'
  monthly_limit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);

ALTER TABLE public.spending_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own budgets"
  ON public.spending_budgets FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 2. UI Changes (SpendingInsightsPage.tsx)

**New state**: `budgets` map (`Record<string, number>`) loaded from `spending_budgets` table.

**Budget Progress Card** — placed after the Sent/Received summary cards:
- Shows a progress bar for "Total Spending" budget (sum of all outgoing current month vs total limit)
- Below that, per-category rows (Send, CashOut, Payment, Recharge) each with a mini progress bar showing spent vs limit
- Color coding: green (<75%), amber (75-90%), red (>90%)
- "Set Budget" button opens a dialog

**Set Budget Dialog**:
- Simple form with inputs for Total limit and per-category limits
- Upserts to `spending_budgets` table on save
- Uses existing Dialog, Input, Button components

**Data source**: Reuses the already-fetched `allTxns` array, filtered to current month outgoing types, grouped by `TYPE_TO_CATEGORY` — no additional database query needed for spending amounts.

### 3. Files Modified
- **New migration**: `spending_budgets` table + RLS
- **`src/pages/SpendingInsightsPage.tsx`**: Add budget state, fetch budgets in useEffect, budget progress card, set budget dialog

### Technical Notes
- Budget data fetched alongside existing transaction query in the same useEffect
- Upsert uses `onConflict: 'user_id,category'` for idempotent saves
- Progress bars use the existing `Progress` component with dynamic color classes
- The `Target` icon from lucide-react will be used for the budget card header




## Add Dashboard Analytics Charts to Admin Overview

### What
Add interactive charts to the Admin Dashboard overview tab showing daily, weekly, and monthly transaction activity. Currently the overview only has stat cards and a transaction table — no visual analytics.

### Changes

#### 1. New component: `src/components/admin/AdminOverviewCharts.tsx`
A self-contained component that fetches transaction data and renders 3 chart sections using Recharts (already in the project):

- **Daily Transaction Trend** (last 14 days) — Bar chart showing volume + line overlay for count
- **Weekly Summary** (last 8 weeks) — Grouped bar chart comparing volume across transaction types
- **Monthly Overview** (last 6 months) — Area chart for cumulative volume + count trend
- **User Signups Trend** (last 14 days) — Line chart from profiles table `created_at`
- **Active Hours Heatmap** — Simple bar chart showing transaction count by hour of day (today)

Data source: `transactions` table (status = completed) + `profiles` table for signups. Uses a period toggle (Daily / Weekly / Monthly) to switch views.

#### 2. `src/pages/AdminDashboard.tsx`
- Import `AdminOverviewCharts`
- Insert `<AdminOverviewCharts />` in the overview tab between the stat cards grid and the Recent Transactions table (around line 1041)

### Technical Details
- Queries: `supabase.from("transactions").select("type, amount, fee, created_at").eq("status", "completed")` with date filters
- Signup query: `supabase.from("profiles").select("created_at")` with date filter
- Charts: `BarChart`, `LineChart`, `AreaChart` from recharts (already installed)
- Period state managed locally with toggle buttons
- Loading skeleton while data fetches
- Responsive grid: 1 col mobile, 2 col desktop


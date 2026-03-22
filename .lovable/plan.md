

## Enhance Admin Overview Charts

### What's Currently There
- Transaction Volume & Count (daily/weekly/monthly toggle)
- Cumulative Volume (6 months area chart)
- User Signups (14 days line chart)
- Active Hours Today (bar chart)

### What to Add (4 new charts)

#### 1. Transaction Type Breakdown (Donut Chart)
- PieChart showing distribution of transaction types (send, receive, cashout, addmoney, bill_pay, etc.)
- Uses existing `txns` data, grouped by `type` field
- Color-coded with legend

#### 2. Revenue & Fees Trend (Area Chart)
- Shows total fees earned over time (daily/weekly/monthly, follows the period toggle)
- Uses the `fee` field from the already-fetched transaction data
- Gradient fill area chart

#### 3. Success vs Failed Ratio (Donut Chart)
- Fetch transactions WITHOUT the `status = completed` filter (add a second query for failed/pending counts)
- Show completed vs failed vs pending as a donut with percentages
- Summary text showing success rate %

#### 4. Agent & Merchant Growth (Line Chart)
- Fetch `agents.created_at` and `merchants.created_at` over the last 6 months
- Dual-line chart showing cumulative registrations over time

### Changes

**`src/components/admin/AdminOverviewCharts.tsx`**
- Add 2 new queries in the `useEffect`: `agents` created_at + `merchants` created_at + transactions (all statuses for success/fail ratio)
- Add 4 new `useMemo` computations for the new chart data
- Add 4 new chart cards to the grid (total becomes 8 charts in a 2-col grid)
- Import `PieChart, Pie, Cell, Legend` from recharts

### Technical Details
- All new data comes from tables already queried elsewhere in the admin dashboard (no new RLS concerns)
- The type breakdown and fee trend reuse the existing `txns` state — no extra fetch needed
- Only 2 additional queries: agents + a separate transactions query without status filter
- Responsive: 2-col on desktop, 1-col on mobile (existing grid)


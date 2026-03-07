

## Plan: Empty State Illustrations + Date Range Picker

### 1. Empty State Illustrations

Add a friendly empty state to the page when `allTxns.length === 0` after loading completes. Instead of showing empty charts, show a single centered illustration card with an icon, heading, and subtitle.

**Where**: After the top bar (line ~245), wrap the rest of the content in a conditional:
- If `!insightsLoading && allTxns.length === 0` → show empty state card
- Otherwise → show existing content

**Empty state UI**:
- Large `BarChart3` icon (from lucide) in a soft gradient circle
- "No transactions yet" heading
- "Start transacting to see your spending insights here" subtitle
- Styled consistently with existing card patterns (`bg-card rounded-3xl border`)

### 2. Date Range Picker

Add a date range picker below the top bar that lets users select a custom period, replacing the hardcoded 6-month window.

**State changes**:
- Add `dateRange` state: `{ from: Date, to: Date }` defaulting to last 6 months
- The `useEffect` fetch query uses `dateRange.from` and `dateRange.to` instead of hardcoded `sixMonthsAgo`
- Add `dateRange` to the `useEffect` dependency array so data refetches on change

**UI**: A row with preset chips ("1M", "3M", "6M", "1Y", "Custom") + a Popover with two Calendar pickers for custom range (using shadcn Popover + Calendar with `pointer-events-auto`).

**Preset logic**:
- 1M: last 1 month
- 3M: last 3 months  
- 6M: last 6 months (default)
- 1Y: last 12 months
- Custom: opens date range popover

**Data adaptation**: The month labels generation and bar chart grouping already work dynamically based on the fetched data range — just need to adjust the `monthLabels` loop to span from `dateRange.from` to `dateRange.to` instead of hardcoded 5 months back.

### Files Modified
- `src/pages/SpendingInsightsPage.tsx` — single file, all changes

### Imports to Add
- `CalendarIcon, BarChart3` from `lucide-react`
- `Calendar` from `@/components/ui/calendar`
- `Popover, PopoverTrigger, PopoverContent` from `@/components/ui/popover`
- `Button` from `@/components/ui/button`
- `format` from `date-fns`


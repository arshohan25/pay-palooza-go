

## Plan: Date Range Picker + Empty States for Spending Insights

### 1. Date Range Picker

Add a date range picker below the page header (after line 267) that controls the time period for all data on the page.

**State changes:**
- Replace the hardcoded "last 6 months" logic with a `dateRange` state: `{ from: Date, to: Date }` defaulting to 6 months ago → today
- The `useEffect` fetch query changes `sixMonthsAgo` to use `dateRange.from` and the upper bound to `dateRange.to`
- The `monthsMeta` computation derives months dynamically from `dateRange.from` to `dateRange.to`
- Preset buttons for quick selection: "1M", "3M", "6M", "1Y", "Custom"
- "Custom" opens a date range picker using two Calendar components (from/to) inside a Popover

**UI:** A row of preset chips + a calendar icon button for custom range, styled consistently with the existing card design. Placed between the header and the sent/received summary cards.

### 2. Empty States

When `!loading && txns.length === 0`, show an empty state illustration instead of blank charts. This applies to:

- **Main page level**: If no transactions at all, show a centered empty state with an icon (BarChart3 from lucide), heading "No transactions yet", and subtitle "Your spending insights will appear here once you make transactions"
- **Donut chart section**: Already conditionally hidden when empty — no change needed
- **Top recipients section**: Already conditionally hidden when empty — no change needed
- **Monthly bar chart**: Show a subtle "No data for this period" message inside the chart area when all bars are zero

### Files Modified
- `src/pages/SpendingInsightsPage.tsx` — add date range state, preset buttons, custom range popover, empty state UI, update fetch logic and month derivation

### Implementation Details

- Import `Calendar`, `Popover`, `PopoverTrigger`, `PopoverContent` from shadcn, `CalendarIcon` from lucide, `format` from date-fns
- Add `pointer-events-auto` to Calendar className per shadcn datepicker guidelines
- Use `differenceInMonths` from date-fns to compute month spans
- Cashback query also respects the selected date range (replace `monthStart` with range)
- The "vs last month" percentage comparison uses the last two months within the selected range


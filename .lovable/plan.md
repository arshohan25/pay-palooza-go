

## Add Date Range Picker & Search Bar to Merchant Transaction History

### Overview
Enhance the `TxnTab` component in `src/pages/MerchantDashboard.tsx` with two new features: a custom date range picker and a search bar for filtering transactions.

### Changes in `src/pages/MerchantDashboard.tsx`

**1. Add filter mode toggle & new state**
- Add `filterMode` state: `"month" | "range"`
- Add `dateRange` state: `{ from: Date | undefined; to: Date | undefined }`
- Add `searchQuery` state (string)
- Toggle buttons ("Monthly" / "Custom Range") above the existing month nav

**2. Custom date range UI**
- When `filterMode === "range"`, replace the month nav arrows with two date picker popovers (From / To) using the existing `Calendar`, `Popover`, `PopoverTrigger`, `PopoverContent` components
- Include a "Clear" button to reset the range
- Add `CalendarIcon` to lucide imports

**3. Search bar**
- Add an `Input` with a `Search` icon below the filter controls, above the summary stats
- Placeholder: "Search by name, phone, or reference..."
- Filters `filtered` results further by matching `searchQuery` against `recipient_name`, `recipient_phone`, `reference`, `description`, and `short_id` (case-insensitive)

**4. Update filtering logic**
- Wrap existing month-based filtering and new range-based filtering in a single `useMemo` that respects `filterMode`
- Chain the search filter on top of the date-filtered results
- Summary stats and exports use the final search-filtered list

**5. Update export filenames**
- When in range mode, use date range in filename instead of month label (e.g. `Statement_2026-03-01_to_2026-03-15`)

### Files modified
- `src/pages/MerchantDashboard.tsx`


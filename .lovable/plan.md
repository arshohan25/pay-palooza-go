

## Plan: Date Range Filtering & CSV Export for Treasury Ledger

### Changes to `src/components/admin/AdminTreasury.tsx`

**1. Add date range filter UI** above the ledger type filter buttons:
- Two date pickers (From / To) using the existing Popover + Calendar pattern
- A "Clear" button to reset the date range
- Filter ledger entries client-side by `created_at` within the selected range

**2. Add CSV export button** next to the ledger title:
- "Export CSV" button with Download icon
- Generates CSV from the currently filtered ledger data (respects both type filter and date range)
- Columns: Type, Amount, Balance After, Counterparty Role, Description, Reference, Date
- Triggers browser download of the CSV file

**3. Update ledger filtering logic:**
- Chain date range filter with existing type filter: `filteredLedger` applies both `filterType` and `dateFrom`/`dateTo` state
- Format dates in CSV as ISO strings for spreadsheet compatibility

### New imports needed:
- `Calendar` from `@/components/ui/calendar`
- `Popover`, `PopoverContent`, `PopoverTrigger` from `@/components/ui/popover`
- `format` from `date-fns`
- `CalendarIcon`, `Download` from `lucide-react`

### No database changes required — all filtering is client-side on the already-fetched 100 ledger entries.




## Add Monthly Filter & Statement Export to Merchant Transaction History

### Changes to `src/pages/MerchantDashboard.tsx` — `TxnTab` component (lines 1317-1521)

**1. Replace filter system with monthly navigation**
- Replace `filter` state (`"all" | "today" | "week"`) with `monthOffset` (number, 0 = current month)
- Add left/right chevron arrows to navigate months (like AgentAnalyticsPage)
- Display current month label (e.g. "March 2026") between arrows
- Add "This Month" / "Last Month" quick-select buttons
- Filter `txns` by the selected month using `startOfMonth`/`endOfMonth` from date-fns

**2. Add summary stats for selected month**
- Show total count, incoming volume, outgoing volume for the filtered month at the top

**3. Add PDF & CSV export buttons**
- Two buttons below the month nav: "Export PDF" and "Export CSV"
- **CSV export**: Generate CSV with columns (ID, Type, Headline, Amount, Fee, Status, Date, Phone, Reference) and trigger browser download
- **PDF export**: Use jsPDF + jspdf-autotable (already in project dependencies) to generate a statement PDF with:
  - Header: merchant business name, month/year, generation date
  - Summary: total txns, incoming, outgoing, net
  - Table of all transactions for the month
  - Footer with page numbers

**4. Import additions**
- Add `ChevronLeft` to lucide imports (already have `ChevronRight`)
- Import `startOfMonth`, `endOfMonth`, `format`, `isWithinInterval`, `addMonths`, `parseISO` from date-fns
- Import jsPDF and autoTable

### Files modified
- `src/pages/MerchantDashboard.tsx`


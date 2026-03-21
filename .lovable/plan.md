

## Change Date Format to "31 Jan 2026" Style

### What
Update all date formatting in the PDF generation code (both invoice and account statement) to use the `"dd MMM yyyy"` format (e.g., "31 Jan 2026") instead of locale-based `"en-BD"` formatting.

### Changes

**`src/components/InvoiceGenerator.tsx`**
- Line 85-87: Change `toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" })` → use `date-fns` `format(date, "dd MMM yyyy")` for the invoice date
- Line 243: Change footer `toLocaleString("en-BD")` → `format(new Date(), "dd MMM yyyy, hh:mm a")`
- Add `import { format } from "date-fns"` at top

**`src/pages/MerchantDashboard.tsx`** (PDF export only)
- Line 1454: Change `toLocaleDateString("en-BD")` → `format(new Date(), "dd MMM yyyy")` for "Generated" line
- Line 1504: Change `toLocaleDateString("en-BD", { day: "numeric", month: "short" })` → `format(new Date(tx.created_at), "dd MMM yyyy")` for transaction table date column

### Files Modified
- `src/components/InvoiceGenerator.tsx`
- `src/pages/MerchantDashboard.tsx`


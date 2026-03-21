

## Fix Logo Aspect Ratio & Taka Symbol in PDF

### Problems Identified
1. **Garbled Taka symbol (৳)**: jsPDF's built-in Helvetica font doesn't include Bengali Unicode characters, so `৳` renders as garbage. Need to replace `৳` with the ASCII text "BDT " or "Tk " prefix which Helvetica can render.
2. **Logo distortion**: Currently rendered at 28×10mm which squishes it. Need to adjust to a more natural aspect ratio like 22×12mm or similar.

### Changes in `src/pages/MerchantDashboard.tsx` (exportPDF)

1. **Fix Taka symbol** — Replace all `৳` occurrences in the PDF generation with `"Tk "` (standard abbreviation) which renders correctly in Helvetica:
   - Summary grid values: `Tk ${fmt(...)}` instead of `৳${fmt(...)}`
   - Transaction table Amount column: `${isIn ? "+" : "-"}Tk ${fmt(tx.amount)}`
   - Transaction table Fee column: `Tk ${fmt(tx.fee)}`

2. **Fix logo dimensions** — Change `doc.addImage(logo, "PNG", ml, 10, 28, 10)` to `doc.addImage(logo, "PNG", ml, 9, 18, 18)` for a squarer aspect ratio matching the actual logo shape.

### Changes in `src/components/InvoiceGenerator.tsx` (buildDoc)

Same fixes applied:
1. Replace all `৳` with `Tk ` in the PDF text output
2. Fix logo dimensions from `28×10` to `18×18`

### Files Modified
- `src/pages/MerchantDashboard.tsx`
- `src/components/InvoiceGenerator.tsx`


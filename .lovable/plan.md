

## Redesign PDF Invoices & Statements as Bank-Style Documents with EasyPay Branding

### Overview
Transform both the invoice PDF (`InvoiceGenerator.tsx`) and the merchant statement PDF (`MerchantDashboard.tsx` exportPDF) into polished, bank-statement-style documents with professional EasyPay branding, structured layout, and clear visual hierarchy.

### Design Direction
- **Bank statement aesthetic**: Clean horizontal rule separators, structured info blocks, formal tone
- **EasyPay branding**: Emerald green (#0EA564) accent bar, logo loaded from `/icons/easypay-logo.png` as base64, company details in header
- **Professional layout**: Two-column header (company info left, document meta right), account/customer info block with light background, transaction table with alternating rows, summary box with bordered totals, formal footer with disclaimers

### Changes

**1. `src/components/InvoiceGenerator.tsx` — Full redesign**
- **Header**: Thin emerald accent strip at top (5mm), then logo + "EasyPay" left-aligned, "INVOICE" title right-aligned with invoice number, date, and due date
- **Separator**: Thin green line below header
- **Bill To / Ship To block**: Light gray (#F8F9FA) rounded box with customer name, phone, address in structured 2-column layout
- **Items table**: Clean grid style (no striped), thin borders, emerald header row, right-aligned amounts, product name with vendor subtitle
- **Summary section**: Right-aligned box with subtotal, discount (green), delivery fee, horizontal rule, bold grand total — resembling a bank statement balance summary
- **Payment info**: Small badge-style label showing payment method
- **Footer**: Horizontal rule, "This is a computer-generated document", EasyPay address, page generation timestamp, centered and formal

**2. `src/pages/MerchantDashboard.tsx` (exportPDF function) — Statement redesign**
- **Header**: Same branding strip + logo pattern, title "ACCOUNT STATEMENT" instead of "Monthly Statement"
- **Account info block**: Gray box with business name, statement period, generated date — structured like bank account header
- **Summary section**: 4-cell grid showing Total Transactions, Incoming, Outgoing, Net — with light background boxes
- **Transaction table**: Clean grid theme, date column formatted properly, color-coded +/- amounts, status badges
- **Footer**: Page numbers, disclaimer text, EasyPay branding

### Logo Handling
- Load logo via `fetch('/icons/easypay-logo.png')` → convert to base64 data URL → `doc.addImage()` in header
- Wrap in try/catch so PDF still generates if logo fails to load

### Files Modified
- `src/components/InvoiceGenerator.tsx`
- `src/pages/MerchantDashboard.tsx` (exportPDF function only, ~lines 1406-1465)


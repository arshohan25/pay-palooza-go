

## Invoice Generator & Printer

Currently the project has:
- `ShareReceiptSheet` — shares/downloads transaction receipts as PNG images
- `AdminTreasury` — generates PDF reports using jsPDF

Missing: A proper **invoice generator** that creates printable/downloadable invoices for shop orders and merchant transactions.

---

### What to Build

**1. Invoice Generator Component** (`src/components/InvoiceGenerator.tsx`)
- Reusable component that accepts order data and generates a styled invoice
- Includes: company logo, invoice number, date, buyer details, shipping address, itemized table (product, qty, unit price, total), subtotal, coupon discount, delivery fee, grand total, payment method
- Two actions: **Download PDF** and **Print** (browser print dialog)
- Uses jsPDF + jspdf-autotable (already in dependencies)

**2. Integration Points**
- **Order Detail Page** (`src/pages/OrderDetailPage.tsx`) — Add "Download Invoice" and "Print" buttons
- **Customer Orders Page** (`src/pages/CustomerOrdersPage.tsx`) — Add invoice icon per order row
- **Admin Order Management** (`src/components/admin/AdminOrderManagement.tsx`) — Add invoice download for any order
- **Merchant Dashboard** (`src/pages/MerchantDashboard.tsx`) — Invoice generation for merchant orders

**3. Invoice PDF Content**
- Header: EasyPay logo + "INVOICE" title
- Invoice number: derived from order_num (e.g., INV-ABC123)
- From: EasyPay platform details
- To: Buyer name, phone, shipping address
- Items table: Product name, variant, quantity, unit price, line total
- Summary: Subtotal, coupon discount, delivery fee, grand total
- Footer: "Thank you for shopping with EasyPay" + generation timestamp
- Print: Opens `window.print()` with a print-optimized hidden iframe

### Files to Create/Modify

| Action | File |
|--------|------|
| Create | `src/components/InvoiceGenerator.tsx` — PDF generation logic + print utility |
| Modify | `src/pages/OrderDetailPage.tsx` — Add invoice download/print buttons |
| Modify | `src/pages/CustomerOrdersPage.tsx` — Add invoice icon per order |
| Modify | `src/components/admin/AdminOrderManagement.tsx` — Add invoice button for admin |

### No database changes needed.


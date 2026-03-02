

## Plan: Add PDF Receipt Download & Confetti to Disbursement Receipt

### 1. Add confetti on receipt appearance
- Import `fireSuccessConfetti` from `@/lib/confetti`
- Add a `useEffect` that fires confetti when `receipt` state becomes non-null

### 2. Add "Print Receipt" PDF button
- Import `jsPDF` and `jspdf-autotable` (already installed)
- Add a `handlePrintReceipt` function that generates a PDF with:
  - EasyPay header with green banner
  - "Disbursement Receipt" title
  - Table rows: Recipient, Phone, Amount, Old/New Treasury Balance, Old/New Recipient Balance, Reference, Timestamp
  - Footer with "Powered by EasyPay"
  - Auto-downloads as `receipt-DISB-xxx.pdf`
- Add a `FileText` (or `Printer`) icon button next to the existing "Dismiss" button in the receipt card

### Files changed
- **`src/components/admin/AdminTreasury.tsx`** only
  - Import `fireSuccessConfetti`, `jsPDF`, `autoTable`, `FileText` icon
  - Add `useEffect` for confetti trigger
  - Add `handlePrintReceipt` function
  - Replace single "Dismiss" button with a two-button row: "Print Receipt" + "Dismiss"


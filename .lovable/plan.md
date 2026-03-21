

## Replace "Test QR" with Real "Generate QR" Flow

### Problem
The Dynamic QR card button says "Test QR" and creates a hardcoded ৳100 demo session. It should let the merchant enter a real amount and reference to generate a production QR.

### Changes — `src/pages/MerchantDashboard.tsx`

1. **Add state for a QR generation dialog**: `showQrGenerate` (boolean), `qrAmount` (string), `qrReference` (string).

2. **Replace `handleTestDynamicQR`** with `handleGenerateQR` that uses the user-entered amount and reference instead of hardcoded `amount: 100` and `DEMO-...` reference.

3. **Change button label** from "Test QR" to "Generate QR" (line 871).

4. **On button click**: Open a small dialog/sheet (z-[80]) with:
   - Amount input (required)
   - Reference input (optional)
   - "Generate" confirm button
   - On confirm, call the same `merchant-payment-api` endpoint with the real amount/reference, then open the QR page.

### File Modified
- `src/pages/MerchantDashboard.tsx`


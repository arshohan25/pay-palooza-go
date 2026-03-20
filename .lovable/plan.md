## Payment Link Page — Two Payment Options

### Summary

Redesign the `/pay` page so when a logged-in customer opens a payment link, they see the payment details (merchant, amount, note) and two clear options:

1. **Scan QR in App** — displays a dynamic QR code on-screen (generated from the payment URL) that can be scanned via the EasyPay app's QR scanner
2. **Pay Manually** — launches the existing `PaymentFlow` with merchant ID and amount pre-filled

### Changes to `src/pages/PayPage.tsx`

1. **Add a "choose method" state** — new state `mode: "choose" | "qr" | "manual"`, default `"choose"`
2. **Choice screen** (when `mode === "choose"`):
  - Payment summary card: merchant code, amount (large), note
  - Two option cards/buttons:
    - **"Scan QR"** — icon + description, sets `mode = "qr"`
    - **"Pay Manually"** — icon + description, sets `mode = "manual"`
3. **QR screen** (when `mode === "qr"`):
  - Back button to return to choice screen
  - Generate a Dynamic QR code from the full payment URL using `QRCode.toDataURL()` (same pattern as merchant dashboard)
  - Display Dynamic QR centered with "Scan with EasyPay App" label
  - Show amount and merchant info below QR
4. **Manual screen** (when `mode === "manual"`):
  - Render `PaymentFlow` with `prefilledMerchantId={merchantCode}` as it currently does
  - `onClose` returns to choice screen or closes

### Technical Details

- Uses `qrcode` library (already in project) to generate QR data URL from the payment link URL itself
- QR encodes: `${window.location.origin}/pay?merchant=X&amount=Y&note=Z`
- No new files needed — single file edit to `PayPage.tsx`
- Unauthenticated flow (login prompt) remains unchanged
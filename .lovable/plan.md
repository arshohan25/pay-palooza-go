

## Show QR Popup + Toast After Generate QR

### What
After generating a QR session, instead of opening a new tab, show a success toast with the session link and display an in-dashboard QR code popup (glassmorphism style, z-[80]) with the QR image, amount, reference, and a copy-link button.

### Changes — `src/pages/MerchantDashboard.tsx`

1. **Add state**: `generatedSessionId` (string), `generatedQrDataUrl` (string), `showQrPopup` (boolean) to track the generated session and its QR image.

2. **Update `handleGenerateQR`** (lines 818-821):
   - Remove `window.open(qrUrl, "_blank")`
   - Generate a QR code data URL using the `qrcode` library (already used in DynamicQrPage): `QRCode.toDataURL(fullUrl, { width: 280 })`
   - Set the generated state and open the popup
   - Show a toast with the payment link and a "Copied!" action

3. **Add QR Popup component** (after the Generate QR Sheet, before closing `</motion.div>`):
   - A `Dialog` or custom overlay at z-[80] showing:
     - QR code image (white bg, rounded-2xl container)
     - Amount + reference display
     - Copy link button
     - Close button
   - Styled to match the glassmorphism aesthetic from the QR page

4. **Add import**: `import QRCode from "qrcode"` at the top of the file.

### File Modified
- `src/pages/MerchantDashboard.tsx`


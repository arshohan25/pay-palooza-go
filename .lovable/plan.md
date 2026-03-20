## Add Dynamic QR Code to Payment Links

### Summary

When a merchant generates a payment link, also generate and display a dynamic QR code for that link so customers can scan it directly instead of clicking a URL.

### Changes to `src/pages/MerchantDashboard.tsx` — `PayLinksTab` component

1. **Import QRCode library** — add `import QRCode from "qrcode"` (already a project dependency)
2. **User can Choose Scan QR or Pay Manual** — User can choose option how to pay, 1. scan qr through app or 2. Pay normal using get way as like enter number otp and pin confirmation
3. **Add QR data URL to link state** — extend the link type to include `qrDataUrl: string`
4. **Generate QR on link creation** — after building the payment URL in `generateLink()`, call `QRCode.toDataURL(url, { width: 200, margin: 2 })` and store the result in the link object
5. **Display QR in each link card** — between the URL preview and the action buttons, render the QR code image centered in a white rounded container with a "Scan to Pay" label
6. **Add "Download QR" button** — alongside Copy/Share buttons, add a download button that saves the QR as a PNG image

### Technical Details

- Uses the existing `qrcode` npm package (already used in `DynamicQrPage.tsx` and `qrWithLogo.ts`)
- QR encodes the full payment URL (e.g. `https://domain/pay?merchant=MRC-XXX&ref=ABC&amount=500`)
- QR generation is async (`toDataURL` returns a promise), so `generateLink` becomes async
- Download uses a temporary `<a>` element with `download` attribute
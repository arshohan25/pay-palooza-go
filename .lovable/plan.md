

## Add EasyPay Logo to Center of All QR Codes

### Approach

Create a shared utility function that draws the EasyPay logo on top of any QR code canvas or data URL. All 4 QR generation locations will use it.

**Key requirement**: Use `errorCorrectionLevel: "H"` (highest) on all QR codes so the center logo area doesn't break scanning — QR codes with "H" level can tolerate ~30% obstruction.

### New File: `src/lib/qrWithLogo.ts`

A utility with two functions:
- `drawLogoOnCanvas(canvas: HTMLCanvasElement, logoSrc: string)` — for `toCanvas` usage (UserQrModal, WalletShareSheet)
- `qrToDataUrlWithLogo(data: string, options, logoSrc: string): Promise<string>` — for `toDataURL` usage (MerchantDashboard, DynamicQrPage)

Both draw a white-bordered circle/rounded-square in the center with the logo (`/icons/easypay-logo.png`) at ~20% of QR size.

### Files Modified

1. **`src/components/UserQrModal.tsx`** — After `QRCode.toCanvas`, call `drawLogoOnCanvas`; add `errorCorrectionLevel: "H"`
2. **`src/components/WalletShareSheet.tsx`** — Same pattern
3. **`src/pages/MerchantDashboard.tsx`** — Replace `QRCode.toDataURL` with `qrToDataUrlWithLogo`
4. **`src/pages/DynamicQrPage.tsx`** — Same pattern

No database changes needed.




## Redesign QR Modal to Match DynamicQrPage Style

Redesign the `QrModal` component inside `src/pages/PayPage.tsx` (lines 136-189) to match the premium glassmorphism aesthetic of the DynamicQrPage — centered popup card instead of bottom sheet feel, with gradient background, merchant icon, and refined layout.

### Changes to `src/pages/PayPage.tsx` — QrModal component only

**Layout**: Center the modal card with generous padding, matching DynamicQrPage's `max-w-sm rounded-3xl` card

**Header**: 
- Remove the thin gradient top bar
- Add "Scan to Pay" title centered with close button absolute-right (keep existing)

**QR section**:
- Larger QR container: white `rounded-2xl p-4 shadow-lg` with `w-64 h-64` QR image (matching DynamicQrPage)
- More breathing room around the QR

**Merchant info below QR**:
- Merchant name in bold (`text-base font-bold`)
- Taka symbol (৳) as a standalone icon-like element in primary color
- "Open EasyPay app → Scan QR" instruction text

**Card styling**: 
- `bg-card/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl shadow-primary/5`
- Matches the DynamicQrPage glassmorphism card

**No backend changes** — only JSX/styling within the QrModal component.


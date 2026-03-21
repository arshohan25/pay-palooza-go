

## Redesign Dynamic QR Payments Card

The uploaded image shows a cleaner, more spacious card design with a teal/green QR icon on the left, bolder typography, and a pill-shaped "Generate QR" button on the right. I will update the existing card (lines 878-898) to match this reference.

### Changes — `src/pages/MerchantDashboard.tsx` (lines 878-898)

Replace the current card with:
- **Layout**: Wider card with more padding (p-5), subtle green gradient background (`from-primary/5 via-card to-primary/8`)
- **Icon**: Larger rounded-2xl icon container (w-14 h-14) with a softer green gradient, using `QrCode` icon at size 26
- **Text**: Title bumped to `text-[15px] font-bold`, description to `text-[11px]` with slightly more line height
- **Button**: Pill-shaped (`rounded-full`), taller (`h-10`), with bolder text and the `ScanLine` icon — matching the green pill button in the reference image
- **Overall feel**: More whitespace, rounder corners (`rounded-2xl` on the card), softer shadow

### File Modified
- `src/pages/MerchantDashboard.tsx`


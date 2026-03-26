

# Redesign Gift Card as Credit/Debit Card Style

## Design
Transform the flat gift card preview into a realistic credit/debit card layout with:
- **Card aspect ratio**: Standard card ratio (~1.586:1), roughly `w-full h-[220px]`
- **Chip icon**: A simulated EMV chip graphic (rounded rectangle with lines) on the left
- **EasyPay logo**: `/icons/easypay-logo.webp` top-right corner
- **Card number area**: Masked dots pattern like `•••• •••• •••• 7842` (generated from brand)
- **Amount**: Large denomination bottom-left
- **Category label**: Bottom-right
- **Brand label**: "EasyPay Gift Card" top area
- **Glossy overlay**: Subtle radial gradient overlay for a 3D sheen effect
- **Rounded corners**: `rounded-[19px]` matching the app's card style

Also update the "My Cards" list items to use the same credit-card style layout.

## Changes

**`src/pages/GiftCardsPage.tsx`**

1. **Preview card** (lines 112-121): Replace the simple gradient block with a credit-card-styled `div`:
   - Outer: `relative overflow-hidden rounded-[19px] h-[210px] bg-gradient-to-br ${selectedBrand.color} p-5 text-white`
   - Top row: EasyPay logo (img, ~28px height) right-aligned, "GIFT CARD" label left
   - Middle: EMV chip SVG element (small gold/silver rounded rect) + masked card number `•••• •••• •••• ••••`
   - Bottom row: `৳${denomination}` left, category name right
   - Glossy overlay: `absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none`

2. **My Cards list** (lines 133-152): Restyle each card similarly — gradient background with credit card layout showing code as the "card number", brand, denomination, and status badge overlaid.

Single file change.


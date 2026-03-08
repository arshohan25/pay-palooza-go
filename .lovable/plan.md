

## Plan: Add Illustrated Icons for More Services Section

### Problem
The More Services section (Refer & Earn, Savings, Coupons, Donations, Loan, Insurance, Gift Cards) uses plain Lucide icons (`Gift`, `Wallet`, `Ticket`, `Heart`, `Banknote`, `ShieldCheck`) which look inconsistent with the premium illustrated SVG icons in the main grid.

### Changes

**1. `src/components/QuickActionIcons.tsx`** — Add 5 new illustrated icon components

Already exists: `ReferIcon` (gift box) and `SavingsIcon` (piggy bank). Need to create:

- **`CouponsIcon`** — Ticket/coupon with a dotted tear line and a percentage badge. Pink-to-rose gradient. Hover: ticket rotates slightly.
- **`DonationsIcon`** — Heart shape with a hand underneath. Red-to-rose gradient. Hover: heart pulses/beats.
- **`LoanIcon`** — Stack of banknotes with a Taka symbol and a clock/timer badge. Amber-to-orange gradient. Hover: notes fan out.
- **`InsuranceIcon`** — Shield with a checkmark and umbrella element. Violet-to-purple gradient. Hover: shield glows/scales.
- **`GiftCardsIcon`** — Gift card rectangle with ribbon and a star. Orange-to-red gradient. Hover: card tilts.

All follow the same `({ isHovered }: IconProps)` pattern with `motion` animations.

**2. `src/components/QuickActions.tsx`** — Update More Services to use illustrated icons

- Import all 7 illustrated icons (`ReferIcon`, `SavingsIcon`, `CouponsIcon`, `DonationsIcon`, `LoanIcon`, `InsuranceIcon`, `GiftCardsIcon`)
- Change `moreServices` array: replace `icon: Gift` etc. with `Icon: ReferIcon` etc.
- Update the rendering code (lines 220-226) to use `<item.Icon isHovered={...} />` instead of `<item.icon size={22} />`, matching the main grid pattern with hover state tracking
- Add `hoveredMoreId` state to track hover on More items
- Remove unused Lucide imports (`Gift`, `Wallet`, `Ticket`, `Heart`, `Banknote`, `ShieldCheck`)


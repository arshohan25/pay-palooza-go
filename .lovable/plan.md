

## Make Merchant Dashboard Full-Screen Width

### What changes
Currently, the merchant dashboard content (stats grid, tab strip, tab content, menu drawer) is constrained to `max-w-xl mx-auto` (max 576px centered). This plan removes that constraint so all sections use the full available screen width.

### Changes to `src/pages/MerchantDashboard.tsx`

Remove or widen the `max-w-xl mx-auto` class from these container elements:

1. **Header inner content** (line ~260): `max-w-xl mx-auto` → remove constraint
2. **Quick Stats grid** (line ~329): `max-w-xl mx-auto` → remove constraint
3. **Tab strip** (line ~370): `max-w-xl mx-auto` → remove constraint
4. **Main content area** (line ~411): `max-w-xl mx-auto` → remove constraint

All four locations get the same treatment: replace `max-w-xl mx-auto` with just the existing padding classes, allowing content to stretch full-width on larger screens while keeping horizontal padding for mobile.

No other files need changes — this is a CSS-only adjustment within the single dashboard page.


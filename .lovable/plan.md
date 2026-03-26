

# Remove Blank Space in Promo Slider

## Problem
The promo banner has visible blank space at the bottom of the card area, and the dot indicators sit below with extra gap, creating unnecessary vertical whitespace (highlighted in red in the screenshot).

## Solution
1. **Overlay the dot indicators on the banner** — position them absolutely at the bottom of the banner card instead of below it, eliminating the `space-y-2` gap.
2. **Remove outer `space-y-2`** — the wrapper div currently adds 8px between the carousel and dots; with overlay dots this is unnecessary.

## Changes

**`src/components/PromoSlider.tsx`**

- Change the wrapper from `<div className="space-y-2">` to `<div className="relative">`.
- Move the dot indicators inside the Embla viewport wrapper and position them with `absolute bottom-2 left-0 right-0` so they float over the bottom of the banner.
- Add a slight semi-transparent backdrop behind dots for readability on media banners.


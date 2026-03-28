

# Replace Online/Offline Status with Store Rating in Vendor Row

## Problem
The vendor row on the product detail page shows "Online" / "Offline" status under the store name. The user wants this removed — online/offline should only be visible inside chat. Instead, show store rating or category for a more premium feel.

## Changes

### File: `src/pages/ProductDetailPage.tsx`

**Vendor row (lines 359-366)** — 2 changes:

1. **Remove the online/offline dot** on the store avatar (lines 359-362): delete the colored dot span
2. **Replace "Online"/"Offline" text** (line 366) with store rating + category display:
   ```
   ⭐ 4.5 · Electronics
   ```
   Use `product.rating` for the rating and `product.category` for the category, styled in muted-foreground text.

**Chat button in bottom bar (line 567-568)** — keep the online dot here since it's chat-related. No change needed.

**Inline chat header (lines 596-604)** — keep online/offline status here. No change needed.

### Summary
- 1 file edit: `src/pages/ProductDetailPage.tsx`
- Remove online indicator from vendor row, replace subtitle with rating + category
- Online/offline status preserved only in chat contexts


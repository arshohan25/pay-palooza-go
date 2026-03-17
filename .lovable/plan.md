

## Change Shop Button to Navigate to /shop Page

### Problem
The homepage "Shop" button currently opens the `ShopFlow` bottom sheet overlay instead of navigating to the full `/shop` marketplace page.

### Solution
Replace all `setShowShop(true)` calls with `navigate("/shop")` in `src/pages/Index.tsx`. Remove the `showShop` state and the `ShopFlow` render. The `ShopFlow` import can also be removed.

### Changes

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Replace `setShowShop(true)` → `navigate("/shop")` in 4 places (lines 177, 278, 291, and the quick-actions handler). Remove `showShop` state (line 73), remove `ShopFlow` import (line 23), remove `ShopFlow` render (line 411). |

Single file, ~7 line deletions/modifications. No new files needed.


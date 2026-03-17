## Redesign Shop Home Page — Premium & Elegant

### Overview

Redesign the shop page for a cleaner, more premium feel. Remove the hardcoded "Collect Vouchers" card and replace it with admin-managed promotional cards fetched from the existing `promo_banners` table (using a new `placement` column to target shop-specific banners).

### Database Change

Add a `placement` column to `promo_banners` so admins can assign banners to specific pages:

```sql
ALTER TABLE promo_banners ADD COLUMN placement text DEFAULT 'home';
```

Values: `home` (default, existing behavior), `shop`, `both`.

### UI Redesign — `ShopPage.tsx`

**Header**: Refined with a subtle gradient accent line and cleaner spacing. Keep search + cart.

**Remove**: The hardcoded "Collect Vouchers" card (lines 260-276).

**Replace with**: A dynamic promo card section that fetches `promo_banners` where `placement IN ('shop', 'both')`. Renders as compact, elegant gradient cards — admin-controlled content.

**Trust Bar**: Slim it down to a single-line icon row with softer styling, more whitespace.

**Category Nav**: Keep as-is add more categories (already clean).

**Promo Slider**: Keep but tighten padding. (image/gif/video banner uploadable within fixed size)

**Trending Section**: Redesign `FlashCard` with slightly larger cards (140px), rounded-2xl, subtle shadow, cleaner typography. Add a thin progress-style "selling fast" indicator for items with low stock.

**Product Grid Section**: 

- Cleaner section header — remove the sparkles animation, use a simple bold heading
- Tighter gap-2.5 grid spacing
- Sort/filter bar simplified

**ProductCard.tsx** refinements:

- Softer border (`border-border/40`), slightly larger corner radius (`rounded-2xl`)
- Price uses `font-extrabold` with primary color for discount prices
- Star rating uses a warm amber fill instead of accent
- Vendor name row slightly bolder
- Add-to-cart button uses filled primary style instead of ghost

### Admin Panel Update — `AdminEcommerceHub.tsx`

In the **Banners** sub-tab (which already renders `AdminBannerManager`), the existing banner manager already handles CRUD. We just need to update `AdminBannerManager` to include a `placement` dropdown (home / shop / both) when creating/editing banners.

### Files Modified

1. `**src/pages/ShopPage.tsx**` — Full redesign: remove voucher card, add dynamic shop promo cards, refined layout
2. `**src/components/shop/ProductCard.tsx**` — Premium styling tweaks
3. `**src/components/admin/AdminBannerManager.tsx**` — Add `placement` field to banner create/edit form
4. **Migration** — Add `placement` column to `promo_banners`
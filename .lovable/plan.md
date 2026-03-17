

## Shop & Admin Dashboard — Comprehensive Feature Audit

After reviewing every component end-to-end, here are the issues and missing features identified:

---

### Bugs / Issues Found

**1. Recently Viewed never records views**
- `useRecentlyViewed().addViewed()` is never called from `ProductDetailPage.tsx`. The hook exists and the display works on ShopPage, but no product is ever tracked.
- Fix: Import `useRecentlyViewed` in `ProductDetailPage.tsx` and call `addViewed(id)` when product loads.

**2. Flash Sale countdown is static**
- The countdown in `ShopPage.tsx` (lines 377-381) calculates hours/minutes once at render and never updates. It should tick every second.
- Fix: Extract the countdown into a small component with a `setInterval` that updates every second, showing hours:minutes:seconds.

**3. Flash Sale banner missing product image**
- The flash sale banner only shows a `Zap` icon but never displays the product image, making it less appealing.
- Fix: Show product image/emoji next to the sale details.

**4. ShopPromoBanner shows title unconditionally (line 127)**
- Despite the PromoSlider fix making title optional, the `ShopPromoBanner` component on line 127 still renders `banner.title` without a conditional check — shows `null` or empty text.
- Fix: Wrap in `{banner.title && <p>...</p>}`.

---

### Missing Features — Shop

**5. Wishlist icon in shop header**
- No quick access to wishlist from shop page. Users have to navigate from account.
- Add a Heart icon button next to the Orders icon in the header linking to `/wishlist`.

**6. "Load More" / Infinite scroll for products**
- Currently loads ALL products in one query (no pagination). With a growing catalog this will be slow.
- Add pagination (load 20 at a time) with a "Load More" button or infinite scroll.

**7. Share product button on ProductCard**
- No way to share a product link from the shop grid — only available on detail page.
- Low priority, skip for now.

---

### Missing Features — Admin Dashboard

**8. Order status change notifications**
- When admin changes order status in `AdminOrderManagement`, no notification is sent to the customer.
- This is a backend concern (would need a trigger or edge function). Note as future improvement.

---

### Implementation Plan

#### Files Modified
1. **`src/pages/ProductDetailPage.tsx`** — Import `useRecentlyViewed`, call `addViewed(id)` on product load
2. **`src/pages/ShopPage.tsx`** — Extract flash sale countdown to a ticking component; add product image to flash banner; add wishlist icon to header; fix ShopPromoBanner conditional title
3. **`src/components/PromoSlider.tsx`** — Verify title conditional (already fixed in prior plan)

#### No database changes needed.

### Summary of Changes
- 4 bug fixes (recently viewed tracking, live countdown, flash sale image, banner title)
- 1 UX addition (wishlist icon in shop header)
- All in 2 files, no migrations


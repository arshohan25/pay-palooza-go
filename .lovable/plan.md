

## Add Related Products to Product Detail Page

### What we'll build
Two horizontally scrollable product carousels at the bottom of the product detail page:
1. **"More from this Store"** — other products from the same vendor (same `merchant_id`), excluding the current product
2. **"You May Also Like"** — products from other vendors in the same category

### Changes

**File: `src/pages/ProductDetailPage.tsx`**

1. **New state**: Add `relatedFromVendor` and `relatedOthers` arrays
2. **New data fetch**: After loading the product, run two parallel queries:
   - `merchant_products` where `merchant_id = product.merchant_id AND id != product.id`, limit 10
   - `merchant_products` where `category = product.category AND merchant_id != product.merchant_id`, limit 10
   - Join with `vendor_stores` to get vendor name/slug for each
3. **New `RelatedProductsRow` component** (inline): A section header + horizontal scroll container rendering compact product cards with image, name, price, discount badge, and rating — tapping navigates to `/product/:id`
4. **Placement**: Insert both carousels after the Tabs section and before the fixed bottom bar, with proper bottom padding (`pb-28` already exists)

### UI Design
- Section header: bold title + "See All" link (navigates to `/shop` or `/shop/:slug`)
- Cards: ~140px wide, aspect-square image, name (2-line clamp), price row — compact horizontal scroll with `snap-x`
- Smooth fade-up entry animation consistent with the rest of the page

### No backend changes needed
All data comes from existing `merchant_products` and `vendor_stores` tables with existing RLS policies.


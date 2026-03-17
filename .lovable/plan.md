

## Phase 3 — Customer Experience (Reviews, Search, AI Recommendations)

### What Already Exists
- `product_reviews` table with full schema (rating, title, body, images, order_id, is_verified_purchase, is_visible)
- `ProductReviews.tsx` — read-only display of reviews
- `WishlistPage.tsx` + `use-wishlist.ts` — fully functional
- `ShopPage.tsx` — has search and category filters, but no price/rating range filters
- `LOVABLE_API_KEY` is available for AI recommendations

### What Needs Building

**A. Write Review Form** (biggest gap — no way for customers to submit reviews)

1. **`src/components/shop/WriteReviewForm.tsx`** — Star rating selector, title, body, image upload (Supabase Storage), submit via direct insert to `product_reviews`
2. **Add "Write Review" button** on `CustomerOrdersPage.tsx` for delivered orders
3. **Add review form to `ProductDetailPage.tsx`** Reviews tab — show form if user has a delivered order for this product and hasn't reviewed yet

**B. Enhanced Search & Filters on ShopPage**

1. **Price range filter** — min/max input fields in a collapsible filter drawer
2. **Rating filter** — "4★ & above" style buttons
3. **Brand filter** — derived from products in the current category
4. Add a filter drawer toggled by the existing `SlidersHorizontal` icon (currently unused in ShopPage)

**C. AI Product Recommendations**

1. **Edge Function: `supabase/functions/product-recommendations/index.ts`**
   - Takes user_id, fetches their recent orders/browsing history
   - Calls Lovable AI (Gemini Flash) with product catalog context
   - Returns ranked product IDs with reasoning
2. **"Recommended For You" section** on ShopPage below the product grid
3. Uses `google/gemini-3-flash-preview` via the Lovable AI Gateway

**D. Post-Delivery Review Prompt**

- On `CustomerOrdersPage.tsx`, delivered orders show a "Rate & Review" button
- Clicking opens `WriteReviewForm` as a sheet/dialog with the order context pre-filled

### Files

| Action | File |
|--------|------|
| Create | `src/components/shop/WriteReviewForm.tsx` |
| Create | `src/components/shop/FilterDrawer.tsx` |
| Create | `supabase/functions/product-recommendations/index.ts` |
| Modify | `src/pages/ProductDetailPage.tsx` — add write review in Reviews tab |
| Modify | `src/pages/CustomerOrdersPage.tsx` — add "Rate" button for delivered orders |
| Modify | `src/pages/ShopPage.tsx` — add filter drawer + AI recommendations section |

### Implementation Order
1. WriteReviewForm + integration into ProductDetail and CustomerOrders
2. FilterDrawer + ShopPage integration
3. AI recommendations edge function + ShopPage section


## Multi-Vendor E-Commerce Marketplace — Phased Implementation Plan

### Important Platform Constraints

This project runs on **Lovable Cloud** (React + Vite + Tailwind + Supabase). It cannot use NestJS, Django, Next.js, Flutter, Docker, or Kubernetes. The plan below works **within the existing stack** and extends it to build a marketplace on top of what's already built.

**What already exists:**

- `merchant_products` table with full CRUD (name, price, stock, images, variants, categories)
- `orders` table with lifecycle tracking
- `ShopFlow.tsx` (1449 lines) — browsing, cart, checkout with EasyPay wallet
- `MerchantProductsTab.tsx` — vendor product management
- `CheckoutPage.tsx` — hosted checkout with OTP + PIN
- Commission engine, wallet system, KYC, RBAC, merchant management

### Phase 1 — Multi-Vendor Store Enhancements (MVP)

**A. Database Migrations (6 new tables, 3 altered)**


| Table                | Purpose                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `vendor_stores`      | Store profile per merchant (logo, banner, slug, description, rating) |
| `product_variants`   | Size/color/SKU rows linked to `merchant_products`                    |
| `product_reviews`    | Customer reviews with rating, text, images                           |
| `wishlists`          | User ↔ product favorites                                             |
| `coupons`            | Discount codes (flat/percent, per-vendor or platform-wide)           |
| `delivery_addresses` | Saved shipping addresses per user                                    |


**Alter `merchant_products`:** Add `sku`, `brand`, `tags[]`, `weight_grams` columns.  
**Alter `orders`:** Add `coupon_id`, `delivery_fee`, `vendor_commission`, `platform_fee`, `escrow_released_at` columns.  
**Alter `order` items:** Normalize into `order_items` table (product_id, variant_id, qty, unit_price, merchant_id) for multi-vendor split.

**B. New Pages & Components**

1. `**/shop**` — Dedicated marketplace page (search, filters, categories, vendor badges)
2. `**/shop/:slug**` — Vendor storefront (banner, products, reviews, rating)
3. `**/product/:id**` — Full product detail (images gallery, variants, reviews, related)
4. `**/wishlist**` — Saved items
5. `**/orders**` — Customer order tracking with multi-vendor split view
6. **Vendor Dashboard** enhancements — Store settings, order fulfillment, inventory alerts

**C. Cart & Checkout Upgrade**

- Multi-vendor cart: group items by vendor, show per-vendor subtotals
- Delivery charge by address (controlled by admin panel) will added with subtotal
- Apply coupon codes
- Delivery address management (add/edit/select)
- Escrow hold: wallet debit on order, release to vendor on delivery confirmation
- Platform commission auto-deduction per order item

### Phase 2 — Escrow & Settlement Engine

**Edge Function: `process-order-settlement**`

- On delivery confirmation → release escrow to vendor wallet minus commission
- Commission split: platform fee + vendor earning (uses existing `commission_tiers` logic)
- Record in `commission_logs` and `treasury_ledger`

**Edge Function: `apply-coupon**`

- Validate coupon code, check expiry/usage limits, return discount amount

### Phase 3 — Customer Experience

- **Product reviews** — post-delivery review prompt, star rating, photo upload
- **Wishlist** — heart icon on product cards, dedicated page
- **Smart search** — full-text search with category/price/rating filters
- **AI recommendations** — Edge function using Gemini to suggest products based on order history

### Phase 4 — Vendor Tools

- **Bulk product upload** — CSV import via edge function
- **Inventory alerts** — low-stock notifications
- **Vendor analytics** — sales charts, top products, revenue breakdown
- **Store customization** — logo, banner, description, social links

### Phase 5 — Delivery & Notifications

- **Delivery tracking** — status updates (shipped → out for delivery → delivered)
- **Push notifications** — order confirmations, shipping updates, delivery alerts
- **Delivery fee calculator** — zone-based pricing (Dhaka metro vs outside)

### Files to Create/Modify


| Action | File                                                             |
| ------ | ---------------------------------------------------------------- |
| Create | `src/pages/ShopPage.tsx` — marketplace browse                    |
| Create | `src/pages/ProductDetailPage.tsx` — single product               |
| Create | `src/pages/VendorStorePage.tsx` — vendor storefront              |
| Create | `src/pages/WishlistPage.tsx`                                     |
| Create | `src/pages/CustomerOrdersPage.tsx`                               |
| Create | `src/components/shop/ProductCard.tsx`                            |
| Create | `src/components/shop/CartDrawer.tsx`                             |
| Create | `src/components/shop/CategoryNav.tsx`                            |
| Create | `src/components/shop/ProductReviews.tsx`                         |
| Create | `src/components/shop/CouponInput.tsx`                            |
| Create | `src/components/shop/DeliveryAddressForm.tsx`                    |
| Create | `src/components/shop/VendorStoreHeader.tsx`                      |
| Create | `src/hooks/use-cart.ts`                                          |
| Create | `src/hooks/use-wishlist.ts`                                      |
| Create | `supabase/functions/process-order-settlement/index.ts`           |
| Create | `supabase/functions/apply-coupon/index.ts`                       |
| Create | `supabase/functions/product-recommendations/index.ts`            |
| Modify | `src/App.tsx` — add new routes                                   |
| Modify | `src/components/ShopFlow.tsx` — refactor into modular components |
| Modify | `src/components/QuickActions.tsx` — add Shop entry point         |


### Development Roadmap

**Week 1-2:** Database migrations + vendor stores + product variants + new routes  
**Week 3-4:** Multi-vendor cart + escrow checkout + settlement engine  
**Week 5-6:** Reviews, wishlist, coupons, search filters  
**Week 7-8:** AI recommendations, bulk upload, vendor analytics  
**Week 9-10:** Delivery tracking, notifications, polish

### What Cannot Be Built on Lovable

- Native mobile apps (Flutter/React Native) — PWA only
- Kubernetes/Docker deployment — managed by Lovable Cloud
- GraphQL API — REST via Supabase Edge Functions only
- AWS S3 — use Supabase Storage instead
- CDN/Cloudflare — handled by Lovable hosting

Shall I start with **Phase 1** (database tables + marketplace page + multi-vendor cart)?

Yes
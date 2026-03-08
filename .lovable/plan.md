

## Plan: Multi-Vendor Shop with Merchant Product Management

### Current State
- **ShopFlow.tsx** (1641 lines): Hardcoded array of 12 mock products, single-vendor, no DB backing
- **MerchantDashboard.tsx** (2323 lines): No product/listing management
- **Database**: `merchants` and `orders` tables exist; no products table

### What We're Building

**1. Database — `merchant_products` table + RLS**

New table storing all merchant listings:

```
merchant_products
├── id (uuid, PK)
├── merchant_id (uuid, FK → merchants.id)
├── name (text)
├── description (text, nullable)
├── price (numeric)
├── original_price (numeric, nullable — for sale badge)
├── category (text — Electronics, Fashion, Home, etc.)
├── emoji (text, default '📦')
├── image_url (text, nullable — future image support)
├── stock (integer, default 0)
├── is_active (boolean, default true)
├── badge (text, nullable — "NEW", "HOT", "SALE")
├── badge_color (text, nullable)
├── rating (numeric, default 0)
├── review_count (integer, default 0)
├── created_at / updated_at (timestamptz)
```

RLS policies:
- **Public read**: Anyone can read `is_active = true` products (shop is public)
- **Merchant write**: Merchant can INSERT/UPDATE/DELETE own products (`merchant_id` matches their merchant row)
- Enable realtime for live product updates

**2. Merchant Dashboard — "My Products" tab (new `MerchantProductsTab.tsx`)**

A dedicated component (~400 lines) with:
- **Product list** with cards showing name, price, stock, status toggle
- **Add Product** sheet: form with name, description, price, original price, category picker, emoji picker, stock, badge
- **Edit/Delete** actions per product
- **Quick stock update** (inline +/- buttons)
- **Empty state** with CTA to add first product
- Modern minimal card design consistent with existing merchant dashboard

Add "Products" to `mainTabs` (alongside Overview, QR) so it's always visible.

**3. Redesigned Multi-Vendor ShopFlow**

Major refactor of ShopFlow.tsx:
- **Data source**: Fetch from `merchant_products` joined with `merchants.business_name` via a new `get_shop_products` SECURITY DEFINER RPC (returns products + vendor name safely)
- **Multi-vendor UI**:
  - Each product card shows vendor badge (merchant name)
  - "Shop by Vendor" horizontal scroll section
  - Vendor filter in category bar
- **Modern minimal redesign**:
  - Cleaner product grid (2-col) with larger images/emoji area
  - Glassmorphism product cards with subtle shadows
  - Sticky search bar with animated filter chips
  - Skeleton loading states during fetch
  - Pull-to-refresh for product list
- **Product detail** shows "Sold by [Merchant Name]" with verified badge
- **Checkout**: `orders` table gets a new `merchant_id` column so orders route to the correct vendor
- **Fallback**: If no DB products found, show a tasteful empty state (not the old hardcoded list)

**4. Database migration — add `merchant_id` to `orders`**

```sql
ALTER TABLE orders ADD COLUMN merchant_id uuid REFERENCES merchants(id);
```

This enables merchants to see orders for their products in their dashboard.

**5. Merchant Dashboard — "Orders" section**

Add order management to the merchant products tab:
- View incoming orders filtered by `merchant_id`
- Update order status (processing → confirmed → shipped → delivered)
- Real-time notifications for new orders

### File Changes Summary

| File | Action |
|------|--------|
| Migration SQL | Create `merchant_products`, add `merchant_id` to `orders`, create `get_shop_products` RPC |
| `src/components/MerchantProductsTab.tsx` | **New** — Product CRUD for merchants |
| `src/components/MerchantOrdersTab.tsx` | **New** — Order management for merchants |
| `src/pages/MerchantDashboard.tsx` | Add "Products" and "Orders" tabs |
| `src/components/ShopFlow.tsx` | Major rewrite — DB-backed multi-vendor with modern UI |

### Design Direction
- Consistent with existing merchant dashboard gradient theme (orange/crimson)
- Product cards: white/card bg, rounded-2xl, subtle border, vendor chip
- Minimal: more whitespace, larger touch targets, fewer decorative elements
- Responsive 2-column grid with smooth stagger animations




## Shop & Admin Dashboard — Missing Features Audit & Plan

After a thorough review of both the Shop frontend and Admin E-Commerce Hub, here are the important missing features and improvements identified:

---

### Shop Homepage Missing Features

**1. Recently Viewed Products Section**
- No tracking of products users have browsed
- Add localStorage-based recently viewed tracking and a horizontal scroll row on the shop home

**2. Flash Sale / Deal of the Day Section**
- No time-limited deal section exists
- Add a `flash_sales` table (`product_id`, `sale_price`, `starts_at`, `ends_at`, `is_active`) and a countdown-based "Deal of the Day" banner on shop home

**3. New Arrivals Section**
- Products are sorted by `created_at` but there's no dedicated "New Arrivals" showcase row
- Add a horizontal row showing products created in the last 7 days

**4. "My Orders" Quick Access**
- No visible link to `/orders` from the shop page — users must navigate from the account page
- Add an orders icon in the shop header

**5. More Category Icons**
- CategoryNav only has 9 hardcoded icons; user specifically asked to "add more categories"
- Add icons for: Grocery, Automotive, Health, Toys, Pets, Office, Garden, Travel

---

### Admin E-Commerce Hub Missing Features

**6. E-Commerce Analytics/Stats Dashboard**
- No overview stats tab in the E-Commerce Hub (total revenue, order count, top products, conversion)
- Add a "Dashboard" sub-tab with summary cards and charts

**7. Inventory Alerts Sub-Tab**
- Low stock is shown as a counter but no dedicated alert/notification system for vendors when stock drops below threshold
- Add an "Inventory" sub-tab showing all low-stock products with quick restock actions

**8. Flash Sales Management**
- No admin interface to create/manage time-limited flash sales
- Add a "Flash Sales" sub-tab with CRUD for the new `flash_sales` table

---

### Database Changes

```sql
-- Flash sales table
CREATE TABLE public.flash_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES merchant_products(id) ON DELETE CASCADE NOT NULL,
  sale_price numeric NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage flash sales" ON public.flash_sales FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view active flash sales" ON public.flash_sales FOR SELECT TO anon, authenticated USING (is_active = true AND starts_at <= now() AND ends_at > now());
```

---

### Files Modified

1. **`src/pages/ShopPage.tsx`** — Add recently viewed section, new arrivals row, flash sale banner with countdown, orders icon in header, integrate flash_sales fetch
2. **`src/components/shop/CategoryNav.tsx`** — Add 8+ more category icons (Grocery, Automotive, Health, Toys, Pets, Office, Garden, Travel)
3. **`src/components/admin/AdminEcommerceHub.tsx`** — Add 3 new sub-tabs: Dashboard (stats), Inventory (low-stock alerts), Flash Sales (CRUD)
4. **Migration** — Create `flash_sales` table with RLS

### Files Created

5. **`src/hooks/use-recently-viewed.ts`** — localStorage hook tracking last 20 viewed product IDs
6. **`src/components/admin/AdminEcommerceStats.tsx`** — E-commerce dashboard with revenue, order, product stats from orders + merchant_products tables
7. **`src/components/admin/AdminFlashSales.tsx`** — Flash sales CRUD manager (product picker, date range, sale price)
8. **`src/components/admin/AdminInventoryAlerts.tsx`** — Low-stock product list with threshold filters and quick stock edit


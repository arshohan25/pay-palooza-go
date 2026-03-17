## Add E-Commerce Management to Admin Panel

The admin panel currently has no shop/e-commerce management section. There are existing database tables (`vendor_stores`, `merchant_products`, `product_variants`, `product_reviews`, `coupons`, `orders`, `order_items`) but no admin UI to manage them.

### What we'll build

A new **"E-Commerce"** nav group in the admin sidebar with dedicated management components:

### 1. Admin E-Commerce Hub (`src/components/admin/AdminEcommerceHub.tsx`)

A tabbed container with sub-tabs:

- **Products** — Browse/search all `merchant_products` with vendor name, stock, price, status. Bulk actions: toggle active, delete. Inline edit price/stock.
- **Vendor Stores** — List all `vendor_stores` with logo, name, slug, product count, status. Toggle active/suspend stores. View store details.
- **Reviews** — List all `product_reviews` with rating, text, user info, product name. Flag/remove inappropriate reviews.
- **Coupons** — List all `coupons` with code, discount, usage count, expiry. Create/edit/deactivate coupons.

Each sub-tab follows existing admin component patterns (Card-based layout, search, filters, bulk actions, detail sheets).

### 2. Admin Nav Update (`src/pages/AdminDashboard.tsx`)

- Add a new **"E-Commerce"** group to `NAV_GROUPS` with items: `{ id: "ecommerce", label: "E-Commerce", icon: ShoppingBag }`
- Add the tab content rendering for `activeTab === "ecommerce"` mapping to `<AdminEcommerceHub />`
- Import the new component and `ShoppingBag` icon

### 3. Stat Cards Enhancement

- Add shop stats to the overview dashboard: total products, total vendor stores, pending reviews count, benner, marketing, promotion and more necessary features

### Files Modified

- `**src/components/admin/AdminEcommerceHub.tsx**` — New file, ~400 lines, tabbed e-commerce management
- `**src/pages/AdminDashboard.tsx**` — Add nav group entry + tab rendering + import

### No Backend Changes

All data comes from existing tables with existing RLS policies (admin has `has_role` access).
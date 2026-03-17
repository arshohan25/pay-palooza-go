

## Phase 4 — Vendor Tools

### What Already Exists
- `vendor_stores` table with full schema (slug, store_name, description, logo_url, banner_url, rating, review_count, social_links, is_active)
- `merchant_products` table already has `sku`, `brand`, `tags[]`, `weight_grams` columns
- `MerchantProductsTab.tsx` — full CRUD for products (add/edit/delete, image upload, stock management)
- `MerchantAnalyticsTab.tsx` — payment session analytics with charts (7d/30d/90d)
- `MerchantDashboard.tsx` — tabs: overview, products, orders, QR, analytics, API, etc.
- No store settings UI exists in the merchant dashboard
- No bulk product upload capability
- No low-stock notification system
- Analytics only covers payment sessions, not product sales/revenue breakdown

### What We'll Build

**A. Vendor Store Settings Tab** (new tab in MerchantDashboard)
- `src/components/MerchantStoreSettingsTab.tsx`
- Edit store_name, description, slug, social_links (JSON: facebook, instagram, website)
- Upload/change logo and banner to Supabase Storage (`product-images` bucket)
- Auto-create `vendor_stores` row if merchant doesn't have one yet
- Preview of how storefront looks

**B. Bulk Product Upload via CSV**
- `src/components/MerchantBulkUploadSheet.tsx`
- CSV file picker → parse with built-in FileReader + manual CSV parsing
- Expected columns: name, price, original_price, category, stock, sku, brand, description
- Preview table before import → batch insert via Supabase
- Download CSV template button
- Add button to MerchantProductsTab header

**C. Low-Stock Inventory Alerts**
- `src/components/MerchantInventoryAlerts.tsx`
- Query products where `stock <= threshold` (default threshold: 5)
- Show as a warning banner at top of Products tab
- Quick-restock button per product (inline stock update)

**D. Enhanced Vendor Analytics** (extend MerchantAnalyticsTab)
- Add product sales section: top products by order_items count, revenue per product
- Revenue breakdown: gross sales, platform fees, net earnings from `order_items`
- Sales trend chart from `order_items.created_at`

### Files

| Action | File |
|--------|------|
| Create | `src/components/MerchantStoreSettingsTab.tsx` — store profile editor |
| Create | `src/components/MerchantBulkUploadSheet.tsx` — CSV import |
| Create | `src/components/MerchantInventoryAlerts.tsx` — low-stock warnings |
| Modify | `src/pages/MerchantDashboard.tsx` — add "Store" tab, wire new components |
| Modify | `src/components/MerchantProductsTab.tsx` — add bulk upload button + inventory alerts |
| Modify | `src/components/MerchantAnalyticsTab.tsx` — add product sales analytics |

### Implementation Order
1. Store Settings tab (new component + add to dashboard tabs)
2. Bulk Upload sheet (new component + integrate into Products tab)
3. Inventory Alerts (new component + embed in Products tab)
4. Enhanced Analytics (extend existing analytics with order_items data)


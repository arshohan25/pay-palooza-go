

## Add Toggle Keys to All Merchant Menu Items

### What
Currently only 5 merchant features (Refunds, Staff, Customers, Coupons, Payouts) have `toggleKey` properties and can be controlled via the Admin Global Feature Toggles. The remaining 8 merchant menu items (Store Settings, Analytics, History, QR Code, API Integration, Pay Links, Settlement, Fees & Charges) plus the 2 main bottom tabs (Products, Orders) lack toggle keys and cannot be disabled by admins.

### Changes — Single file: `src/pages/MerchantDashboard.tsx`

1. **Add `toggleKey` to all `menuItems`** that currently lack one:
   - `store` → `merchant_store_settings`
   - `analytics` → `merchant_analytics`
   - `transactions` → `merchant_transactions`
   - `qr` → `merchant_qr`
   - `api` → `merchant_api`
   - `paylinks` → `merchant_paylinks`
   - `settlements` → `merchant_settlements`
   - `mdr` → `merchant_mdr`

2. **Add `toggleKey` to `mainTabs`** (Products, Orders):
   - Add optional `toggleKey` to the mainTabs type
   - `products` → `merchant_products`
   - `orders` → `merchant_orders`

3. **Apply toggle filtering to `visibleMainTabs`**:
   - Update the `visibleMainTabs` memo to also filter out disabled toggles, same pattern as `visibleMenuItems`

### Result
All merchant features become controllable from the Admin Global Toggles panel under the "Merchant" section tab. Admins can enable/disable any merchant feature individually.


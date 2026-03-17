

## Auto-create Vendor Store on First Product Add

### Problem
Merchants must manually visit the "Store" tab and click "Create Store" before their products appear in the marketplace. If they skip this step, their products exist in `merchant_products` but no `vendor_stores` row exists, so `/shop` and `/shop/:slug` show nothing.

### Solution
Before inserting a new product in `MerchantProductsTab.tsx`, check if a `vendor_stores` record exists for this merchant. If not, auto-create one with sensible defaults derived from the merchant's `business_name`.

### Changes

**File: `src/components/MerchantProductsTab.tsx`**

1. **Add `businessName` prop** — update the `Props` interface to accept `businessName: string` (already available in the parent).

2. **Add auto-create helper** — before the product insert in `handleSave()` (and in `MerchantBulkUploadSheet`), check for an existing `vendor_stores` row. If none exists, insert one with:
   - `store_name`: `businessName`
   - `slug`: derived from `businessName` (lowercased, hyphenated)
   - `is_active`: `true`
   - `merchant_id`: current merchant ID

3. **Same logic in `MerchantBulkUploadSheet.tsx`** — add the auto-create check before bulk insert as well, passing `merchantId` and `businessName` through.

**File: `src/pages/MerchantDashboard.tsx`**

4. Pass `businessName={merchant.business_name}` to `MerchantProductsTab` (line 400).

This is a ~20-line addition across 3 files. The store can still be customized later via the Store tab.




## Insert Missing Merchant Toggle Keys into Database

### Problem
The code defines 13 merchant `toggleKey` values, but only 5 exist in the `global_feature_toggles` table. The 8 new ones added in the previous change were never inserted into the database, so they don't show up in the Admin Global Toggles "Merchant" section.

### Fix
Run a single database migration to insert the 8 missing merchant toggle rows:

| feature_key | label | is_enabled |
|---|---|---|
| merchant_products | Merchant Products | true |
| merchant_orders | Merchant Orders | true |
| merchant_store_settings | Merchant Store Settings | true |
| merchant_analytics | Merchant Analytics | true |
| merchant_transactions | Merchant Transaction History | true |
| merchant_qr | Merchant QR Code | true |
| merchant_api | Merchant API Integration | true |
| merchant_paylinks | Merchant Pay Links | true |
| merchant_settlements | Merchant Settlement | true |
| merchant_mdr | Merchant Fees & Charges | true |

All will default to `is_enabled = true` so existing merchant functionality remains unaffected. No code changes needed -- only a database insert.


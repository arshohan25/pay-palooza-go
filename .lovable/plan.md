

## Complete Merchant Coupon Creator Flow

### What Already Exists
- `coupons` table with all needed columns: `code`, `discount_type`, `discount_value`, `max_discount`, `min_order_amount`, `merchant_id`, `usage_limit`, `used_count`, `starts_at`, `expires_at`, `is_active`
- RLS policies already allow merchants to CRUD their own coupons
- No database changes needed

### Implementation — Rewrite `MerchantCouponsTab.tsx`

**Props**: Accept `merchantId` from dashboard (like RefundsTab/CustomersTab)

**Data Layer**:
- Fetch coupons from `coupons` table filtered by `merchant_id`
- Realtime subscription for live updates

**Create Coupon Sheet**:
- Code field (auto-uppercase, validated unique)
- Description (optional)
- Discount type toggle: Percentage / Flat
- Discount value input
- Max discount (for percentage type only)
- Min order amount
- Usage limit
- Expiry date picker
- Submit inserts into `coupons` table with `merchant_id`

**Coupon List**:
- Summary cards: Total, Active, Total Used (from real data)
- Toggle switch to enable/disable coupons (updates `is_active`)
- Delete coupon option
- Status badges and usage progress

**Dashboard Update**:
- Pass `merchantId` to `MerchantCouponsTab` in the render section

### Files Changed
1. `src/components/merchant/MerchantCouponsTab.tsx` — full rewrite
2. `src/pages/MerchantDashboard.tsx` — pass `merchantId` prop


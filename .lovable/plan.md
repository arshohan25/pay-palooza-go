

## Complete Customer Directory — Real Data from Orders

### Overview
Replace the mock-data `MerchantCustomersTab` with a working component that aggregates real customer data from the `orders` table. No new database tables needed — we query orders grouped by buyer, with tier assignment based on total spend.

### Approach
Since orders already store `shipping_name`, `shipping_phone`, and `user_id` (buyer), we can aggregate customer insights directly via a database view or client-side aggregation. A database view is cleaner.

### Database Migration

**Create `merchant_customer_insights` view:**
```sql
CREATE VIEW merchant_customer_insights AS
SELECT
  o.merchant_id,
  o.user_id AS customer_user_id,
  MAX(o.shipping_name) AS customer_name,
  MAX(o.shipping_phone) AS customer_phone,
  SUM(o.total) AS total_spent,
  COUNT(*) AS order_count,
  MAX(o.created_at) AS last_order_at
FROM orders o
WHERE o.status NOT IN ('cancelled')
GROUP BY o.merchant_id, o.user_id;
```

Enable RLS-like access by wrapping in a **SECURITY DEFINER function** `get_merchant_customers(p_merchant_id UUID)` that:
- Verifies the caller owns the merchant record
- Returns aggregated rows with tier assignment (Gold ≥ ৳10k, Silver ≥ ৳5k, Bronze ≥ ৳1k, New below)

### Component Rewrite — `MerchantCustomersTab.tsx`

- Accept `merchantId` prop (like RefundsTab)
- Call RPC `get_merchant_customers` on mount
- Realtime subscription on `orders` table filtered by merchant for live updates
- Summary cards: Total Customers, Lifetime Value, Avg Order Value
- Customer list with tier badges, search/filter by name
- Empty state when no orders exist yet
- Loading skeleton

### Dashboard Update
- Pass `merchantId` to `MerchantCustomersTab` in `MerchantDashboard.tsx`

### Files Changed
1. **Database migration** — security definer function
2. **`src/components/merchant/MerchantCustomersTab.tsx`** — full rewrite with real data
3. **`src/pages/MerchantDashboard.tsx`** — pass `merchantId` prop


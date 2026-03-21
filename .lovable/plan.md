

## Complete Refund Management Flow

### Overview
Build a fully functional merchant refund system. Create a new `merchant_refunds` database table, a secure RPC for processing refunds (crediting buyer wallet, debiting merchant), and rewrite the `MerchantRefundsTab` component with real data, an "Issue Refund" sheet, and status management.

### Database Migration

**1. Create `merchant_refunds` table:**
- `id` UUID PK
- `merchant_id` UUID references merchants(id)
- `order_id` UUID references orders(id)
- `order_num` TEXT (denormalized for display)
- `customer_name` TEXT
- `customer_user_id` UUID (buyer)
- `amount` NUMERIC NOT NULL
- `refund_type` TEXT (`full` | `partial`)
- `reason` TEXT NOT NULL
- `status` TEXT DEFAULT `pending` (`pending` | `approved` | `rejected`)
- `admin_note` TEXT
- `reviewed_by` UUID
- `reviewed_at` TIMESTAMPTZ
- `created_at` / `updated_at` TIMESTAMPTZ

**2. RLS Policies:**
- Merchants can SELECT and INSERT their own refunds (`merchant_id` matches their merchant record)
- Admins can SELECT/UPDATE all via `has_role()`

**3. Create `process_merchant_refund` SECURITY DEFINER RPC:**
- Admin-only function
- On approve: credit buyer wallet, record `addmoney` transaction, update refund status
- On reject: update status with admin note
- Audit log entry

**4. Enable realtime** on `merchant_refunds`

### Component Rewrite — `MerchantRefundsTab.tsx`

**Data fetching:**
- Query `merchant_refunds` filtered by merchant's `merchant_id`
- Join with orders to show order details
- Realtime subscription for live status updates

**Issue Refund Sheet:**
- Search/select from merchant's delivered/completed orders
- Choose full or partial refund (partial: enter custom amount up to order total)
- Reason text field (required)
- Submit creates a `pending` refund request

**Refund List:**
- Summary cards (Total, Pending, Approved amount)
- List with status badges, filter by status
- Empty state when no refunds exist

### Admin Side
- The existing admin return requests panel or a new section in admin dashboard can show pending merchant refunds for approval/rejection. This uses the `process_merchant_refund` RPC.

### Files Changed
1. **Database migration** — new table, RLS, RPC, realtime
2. **`src/components/merchant/MerchantRefundsTab.tsx`** — full rewrite with real data




## Complete Staff & Payouts Flow

### Overview
Create two new database tables (`merchant_staff` and `merchant_payouts`) with RLS, then rewrite both stub components to use real data with CRUD operations and real-time subscriptions.

---

### 1. Database Migration

**`merchant_staff` table:**
- `id` UUID PK
- `merchant_id` UUID references merchants(id)
- `name` TEXT NOT NULL
- `phone` TEXT NOT NULL
- `role` TEXT NOT NULL (Manager/Cashier/Viewer) — validated via trigger
- `is_active` BOOLEAN DEFAULT true
- `created_at` / `updated_at` TIMESTAMPTZ

**`merchant_payouts` table:**
- `id` UUID PK
- `merchant_id` UUID references merchants(id)
- `amount` NUMERIC NOT NULL
- `bank_name` TEXT
- `account_number` TEXT
- `account_holder` TEXT
- `status` TEXT DEFAULT 'pending' (pending/completed/rejected) — validated via trigger
- `admin_note` TEXT
- `reviewed_by` UUID
- `reviewed_at` TIMESTAMPTZ
- `reference` TEXT (auto-generated PO-XXXXX)
- `created_at` / `updated_at` TIMESTAMPTZ

**RLS Policies:**
- Merchants can SELECT/INSERT/UPDATE/DELETE their own staff (matched via merchant_id → merchants.user_id)
- Merchants can SELECT/INSERT their own payouts
- Admins can SELECT/UPDATE all payouts via `has_role()`

**Admin RPC — `process_merchant_payout`:**
- On approve: debit merchant wallet, record transaction, update payout status, notify merchant
- On reject: update status with admin note, notify merchant
- Audit log entry

**Enable realtime** on both tables.

---

### 2. Rewrite `MerchantStaffTab.tsx`

- Accept `merchantId` prop
- Fetch staff from `merchant_staff` filtered by merchant_id
- Realtime subscription for live updates
- **Add Staff Sheet**: name, phone, role (Manager/Cashier/Viewer) selector
- **Staff List**: toggle active/inactive via `is_active` update, delete option
- Role permissions info card (kept from current UI)
- Summary: Total staff, Active count

---

### 3. Rewrite `MerchantPayoutsTab.tsx`

- Accept `merchantId` prop
- Fetch payouts from `merchant_payouts` filtered by merchant_id
- Realtime subscription for live updates
- **Request Payout Sheet**: amount input, auto-populated bank details from merchant record, submit creates pending payout
- **Payout List**: summary cards (Total/Pending/Paid), status badges, filter by status
- Empty state when no payouts exist

---

### 4. Update `MerchantDashboard.tsx`

- Pass `merchantId` to both `MerchantStaffTab` and `MerchantPayoutsTab`

---

### Files Changed
1. **Database migration** — two tables, RLS, validation triggers, admin RPC, realtime
2. **`src/components/merchant/MerchantStaffTab.tsx`** — full rewrite
3. **`src/components/merchant/MerchantPayoutsTab.tsx`** — full rewrite
4. **`src/pages/MerchantDashboard.tsx`** — pass merchantId props


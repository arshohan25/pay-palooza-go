

## Link Existing Users as Merchant Staff

### What Changes

**Goal**: When a merchant adds staff by phone number, the system resolves that phone to an existing EasyPay user. That user then sees a "Staff" indicator and can access a **read-only view** of the merchant dashboard based on their role.

---

### 1. Database Migration

**Add `user_id` column to `merchant_staff`:**
```sql
ALTER TABLE merchant_staff ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
```

**Create a `resolve_staff_user` trigger** that auto-populates `user_id` by looking up the phone in `profiles`:
- On INSERT/UPDATE of `phone`, find matching `profiles.user_id`
- Set `merchant_staff.user_id` accordingly (NULL if not found — staff entry still saved)

**Create `get_staff_merchant_access(p_user_id UUID)` SECURITY DEFINER RPC:**
- Returns the merchant_id, merchant business_name, and staff role for any active staff records linked to the given user_id
- Used by the app to detect if the logged-in user is staff somewhere

**RLS update**: Add a policy so linked staff users can SELECT their own `merchant_staff` row.

---

### 2. Update `MerchantStaffTab.tsx`

- When adding staff, after insert, show whether the phone was matched to an existing user (resolved badge vs "Not on EasyPay" warning)
- Display a "Linked" badge next to staff entries where `user_id` is not null
- Keep existing CRUD (toggle active, delete, role assignment)

---

### 3. Staff Access to Merchant Dashboard

**Update `MerchantDashboard.tsx`:**
- On load, if the user doesn't have a `merchant` role, call `get_staff_merchant_access` RPC
- If staff access exists, load the merchant dashboard in a **restricted mode** based on role:
  - **Manager**: Full read access to all tabs
  - **Cashier**: Orders + Products tabs only
  - **Viewer**: Overview only (read-only)
- Show a "Staff" badge in the header with role name
- Hide menu items the staff role doesn't have access to

**Update `App.tsx` route guard:**
- The `/merchant` route currently requires `merchant` or `admin` role
- Add logic: also allow access if `get_staff_merchant_access` returns a result for the user (staff of any merchant)
- This means we need a new check — either extend `RoleGuard` or create a `MerchantOrStaffGuard` wrapper

---

### 4. Staff Detection Hook — `use-staff-access.ts`

New hook that:
- Calls `get_staff_merchant_access` for the current user
- Caches the result
- Returns `{ merchantId, merchantName, staffRole, isStaff, loading }`
- Used by both the route guard and MerchantDashboard

---

### Files Changed
1. **Database migration** — `user_id` column, resolve trigger, RPC, RLS policy
2. **`src/hooks/use-staff-access.ts`** — new hook
3. **`src/components/merchant/MerchantStaffTab.tsx`** — show linked status
4. **`src/pages/MerchantDashboard.tsx`** — staff restricted mode, role-based tab filtering
5. **`src/App.tsx`** — update `/merchant` route to allow staff access


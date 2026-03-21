

## Add 5 Admin-Gated Merchant Features

Build 5 new merchant dashboard tabs (Refunds, Staff, Customers, Coupons, Payouts) that are **hidden by default** and only appear when an admin enables the corresponding toggle via the Global Feature Toggles panel. This creates a "feature drip" strategy to attract and retain merchants.

### New Features

| Feature | Tab ID | Toggle Key | Description |
|---------|--------|------------|-------------|
| Refund Management | `refunds` | `merchant_refunds` | Issue full/partial refunds with reason tracking |
| Staff Accounts | `staff` | `merchant_staff` | Add employees with limited access roles |
| Customer Directory | `customers` | `merchant_customers` | View repeat buyers, purchase history, lifetime value |
| Discount/Coupon Creator | `coupons` | `merchant_coupons` | Create store-specific promo codes |
| Payout Requests | `payouts` | `merchant_payouts` | Manual withdrawal requests to linked banks |

### Implementation Steps

**1. Database Migration**
- Insert 5 new rows into `global_feature_toggles` with `is_enabled = false` and keys prefixed `merchant_` so admin can control visibility.

**2. Create 5 New Components**
- `src/components/merchant/MerchantRefundsTab.tsx` — List order-based refunds, issue full/partial refund with reason field, status tracking.
- `src/components/merchant/MerchantStaffTab.tsx` — Add/remove staff members with role assignment (cashier, manager, viewer), status toggles.
- `src/components/merchant/MerchantCustomersTab.tsx` — Aggregate customer data from orders: name, total spent, order count, last purchase.
- `src/components/merchant/MerchantCouponsTab.tsx` — CRUD for store-specific discount codes with percentage/flat options, expiry dates, usage limits.
- `src/components/merchant/MerchantPayoutsTab.tsx` — Request withdrawals to linked bank, view payout history and status.

All tabs will use placeholder/mock UI initially (no new database tables), styled consistently with existing merchant tabs.

**3. Update MerchantDashboard.tsx**
- Add `useGlobalToggles` hook.
- Expand `MerchTab` type with: `"refunds" | "staff" | "customers" | "coupons" | "payouts"`.
- Add the 5 new items to `menuItems` array, each conditionally rendered based on `!isDisabled("merchant_<key>")`.
- Add corresponding tab content rendering in the main view switcher.

### How It Works
- Admin goes to **Global Feature Toggles** → sees 5 new `merchant_*` toggles (all OFF by default).
- Admin enables e.g. "Merchant Refunds" → it instantly appears in all merchant hamburger menus via realtime sync.
- Merchants see new features appear organically, creating engagement and perceived platform growth.

### Technical Details
- Uses existing `useGlobalToggles` hook with realtime subscription — no new hooks needed.
- Toggle keys follow existing convention (`merchant_refunds`, `merchant_staff`, etc.).
- Menu items filtered at render time: `menuItems.filter(item => !isDisabled(item.toggleKey))`.
- All 5 component files are UI-only stubs with polished empty states, ready for backend wiring later.


# Granular Staff Permissions on Invite

Right now a merchant only picks **Manager / Cashier / Viewer** when inviting staff, and the dashboard hard-codes which tabs each role sees. As a senior HR, the merchant should be able to **explicitly check which features each invited person can see or use** — and edit those permissions later.

## What the merchant will see

In **Add Staff** (and a new **Edit Permissions** sheet on each row):

1. **Pick a role** (Manager / Cashier / Viewer) — this pre-fills sensible defaults.
2. **Pick exact features** via grouped checkboxes, with a clear "View" vs "Manage" distinction where it matters:

   - **Operations**: Orders (View / Manage), Refunds (View / Process), Inbox / Customer Chat
   - **Catalog**: Products (View / Edit), Coupons, Inventory alerts
   - **Money**: Transactions, Payouts, Settlements, MDR
   - **Customers & Growth**: Customers list, Analytics, Pay Links
   - **Store**: Store settings, QR codes
   - **Admin**: Staff management, API access, Notifications

3. A **"Copy from preset"** button per role so an HR-style merchant can start from Cashier defaults and tweak.
4. Live summary chip: *"Can access 6 of 14 features"*.

Permissions are saved per-staff and take effect the moment the staff member opens the dashboard (no logout needed — already realtime).

## Defaults per role (pre-checked on invite)

- **Manager**: everything except `staff_manage` and `api_access` (owner-only).
- **Cashier**: `orders_manage`, `products_view`, `inbox`, `customers_view`, `qr`.
- **Viewer**: `overview` + `*_view` only (orders_view, products_view, transactions_view, analytics).

## Technical changes

### 1. Database (migration)

Add to `merchant_staff`:
```sql
ALTER TABLE public.merchant_staff
  ADD COLUMN permissions jsonb NOT NULL DEFAULT '{}'::jsonb;
```
Backfill existing rows from their `role` using the defaults above (one-shot UPDATE in the same migration).

Update `validate_merchant_staff_role` trigger (or add a new `validate_merchant_staff_permissions` trigger) to:
- Reject unknown permission keys.
- Force `staff_manage=false` and `api_access=false` for any non-owner row.

Update the `get_staff_merchant_access` RPC to also return `permissions jsonb` so the client gets it in one round-trip.

### 2. Permission catalog (single source of truth)

New file `src/lib/staffPermissions.ts`:
```ts
export const STAFF_PERMISSIONS = [
  { key: "orders_view",      label: "View orders",        group: "Operations" },
  { key: "orders_manage",    label: "Process orders",     group: "Operations", implies: ["orders_view"] },
  { key: "refunds_view",     label: "View refunds",       group: "Operations" },
  { key: "refunds_manage",   label: "Issue refunds",      group: "Operations", implies: ["refunds_view"] },
  { key: "inbox",            label: "Customer inbox",     group: "Operations" },
  { key: "products_view",    label: "View products",      group: "Catalog" },
  { key: "products_manage",  label: "Edit products",      group: "Catalog", implies: ["products_view"] },
  { key: "coupons",          label: "Coupons",            group: "Catalog" },
  { key: "transactions",     label: "Transactions",       group: "Money" },
  { key: "payouts",          label: "Payouts",            group: "Money" },
  { key: "settlements",      label: "Settlements",        group: "Money" },
  { key: "mdr",              label: "MDR / fees",         group: "Money" },
  { key: "customers_view",   label: "Customers",          group: "Growth" },
  { key: "analytics",        label: "Analytics",          group: "Growth" },
  { key: "paylinks",         label: "Pay links",          group: "Growth" },
  { key: "qr",               label: "QR codes",           group: "Store" },
  { key: "store_settings",   label: "Store settings",     group: "Store" },
  { key: "notifications",    label: "Notification prefs", group: "Personal" },
] as const;

export const ROLE_DEFAULTS: Record<"Manager"|"Cashier"|"Viewer", string[]> = { ... };
export const TAB_TO_PERMISSION: Record<MerchTab, string> = { ... }; // maps MerchantDashboard tab id → permission key
```

### 3. Hook

`src/hooks/use-staff-access.ts` — extend cached return type to include `permissions: Record<string, boolean>` and a helper `can(key: string): boolean`.

### 4. Dashboard enforcement

`src/pages/MerchantDashboard.tsx`:
- Replace the hard-coded `staffAllowedTabs` switch with `tabs.filter(t => can(TAB_TO_PERMISSION[t.id]))`.
- Owners (non-staff) keep full access unchanged.
- For action-level guards (e.g. refund button inside Orders), gate with `can("refunds_manage")`.

### 5. Staff tab UI

`src/components/merchant/MerchantStaffTab.tsx`:
- Add Staff sheet: after the role pills, render a grouped checkbox list driven by `STAFF_PERMISSIONS`. Selecting a role re-applies `ROLE_DEFAULTS[role]`. `implies` are auto-checked.
- Each staff row: replace the lone role badge with `Role · N features` and add a **"Permissions"** button that opens an Edit sheet with the same picker, saving back to `merchant_staff.permissions`.
- Insert/update payloads include `permissions`.

### 6. Edge function

`supabase/functions/notify-staff-invite/index.ts` — include the granted feature count in the SMS/push body so the invitee knows their scope: *"You've been added as Cashier (6 features) at …"*.

## Out of scope

- No changes to merchant owner permissions.
- No changes to authentication / OTP flow.
- API tab and staff-management tab remain owner-only by trigger, regardless of UI.

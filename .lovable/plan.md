

## Move "Store" from Main Tabs to Hamburger Menu

### Change in `src/pages/MerchantDashboard.tsx`

**1. Remove "Store" from `mainTabs` array (line 115)**
- Delete `{ id: "store", icon: Store, label: "Store" }` from `mainTabs`

**2. Add "Store" to `menuItems` array (line 118)**
- Insert `{ id: "store", icon: Store, label: "Store Settings", desc: "Customize your storefront" }` into `menuItems` (e.g. as the first item or after Analytics)

No other changes needed — the full-screen overlay rendering for `activeTab === "store"` and the hamburger menu drawer already handle all `menuItems` dynamically.

### Files modified
- `src/pages/MerchantDashboard.tsx`


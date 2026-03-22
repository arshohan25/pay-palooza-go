

## Organize Global Toggles by Section

### Problem
All toggles are currently split into just two tabs — "General" and "Account" — making it hard to find specific features. Merchant, Agent, Distributor toggles are mixed together.

### Solution
Replace the 2-tab layout with a **sectioned accordion or multi-tab** layout that groups toggles by their prefix/category.

### Sections (based on current data + future growth)

| Section | Prefix/Keys | Icon |
|---------|------------|------|
| **Wallet & Transfers** | `send_money`, `cash_out`, `cash_in`, `add_money`, `payment`, `bank_transfer` | Wallet |
| **Services** | `mobile_recharge`, `pay_bill`, `savings`, `donations`, `loan`, `insurance`, `gift_cards`, `drive_offers` | Zap |
| **Shopping** | `shop`, `coupons`, `qr_scan`, `refer` | ShoppingBag |
| **Merchant** | `merchant_*` | Store |
| **Account** | `account_*` | UserCog |
| **Reserved Slots** | `feature_slot_*` | Box |
| **Agent** | `agent_*` (future) | UserCheck |
| **Distributor** | `distributor_*` (future) | Building2 |
| **Other** | anything unmatched | Settings2 |

### Implementation

**File**: `src/components/admin/AdminGlobalToggles.tsx` — rewrite the tab/filter logic

1. Define a `SECTIONS` array with `{ id, label, icon, matcher }` where matcher is a function checking feature_key prefix or explicit key list
2. Replace the 2-tab `Tabs` component with a **scrollable accordion** (`Collapsible` from shadcn) — each section is a collapsible card showing:
   - Section header with icon, label, and badge showing enabled/disabled count
   - Toggle list inside (reuse existing `renderToggleList`)
3. Sections with zero toggles are hidden (won't show empty Agent/Distributor sections until toggles are added)
4. Bulk actions (All On / All Off) remain at the top, operating on all toggles
5. "Add Toggle" dialog gets a **Section** dropdown so new toggles auto-get the correct prefix

### Files Changed
1. `src/components/admin/AdminGlobalToggles.tsx` — full rewrite of grouping logic




## Merchant-Specific Limits Configuration Panel

### Current State
The `AdminLimitManager` already has Global Defaults (with user/merchant/agent role filter), User Overrides (search any user), and Bulk Actions (apply to all of a role). However, there is no dedicated **merchant-focused** panel that lets admins:
- See all merchants with their current effective limits at a glance
- Quickly adjust individual merchant limits inline
- View merchant-specific transaction types (Payment incoming, Send Money, Cash Out, Settlement)
- See merchant business details alongside limits

### Plan

**Add a 4th tab "Merchant Limits" to `AdminLimitManager`** with a dedicated merchant-centric view:

1. **`AdminLimitManager.tsx` — New `MerchantLimitsTab` component**
   - Fetches all active merchants joined with their profiles (`merchants` + `profiles` tables)
   - Displays a searchable/filterable list of merchants showing: business name, phone, category, status
   - For each merchant, show their effective limits (check `user_limit_overrides` for that merchant's `user_id`, fall back to `transaction_limits` where `applies_to = 'merchant'`)
   - Inline edit: click a merchant row to expand and see all txn type limits with editable fields
   - Quick actions: "Set Override" dialog pre-filled with merchant's user_id, "Reset to Defaults" button
   - Merchant-relevant txn types highlighted: `payment`, `send`, `cashout`, `banktransfer`

2. **`AdminLimitManager.tsx` — Update main tabs layout**
   - Change `grid-cols-3` to `grid-cols-4`
   - Add "Merchant Limits" tab with `Store` icon

### No database changes needed — uses existing `transaction_limits` and `user_limit_overrides` tables.

### Key Features
- Merchant list with search by business name or phone
- Expandable rows showing effective limits per txn type (override vs default)
- Inline override creation with merchant context pre-filled
- Bulk reset for a single merchant's overrides
- Category badge and status indicator per merchant


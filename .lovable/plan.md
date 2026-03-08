

## Fix Per-User Limit Overrides (Increase/Decrease)

### Problem
The User Overrides tab in the Limit Manager allows admins to search a user and add limit overrides, but the overrides table is empty (confirmed via database query), meaning saves are silently failing or the admin hasn't been able to successfully complete the flow. The `transaction_limits` queries still use `as any` casts which bypass type checking and can hide errors.

### Root Cause Analysis
1. **`transaction_limits` queried with `as any`** — The table exists in generated types but is still cast to `any`, hiding potential errors
2. **No visible feedback on the override list after saving** — The override card only shows existing overrides but doesn't show the user's effective limits (global defaults) alongside, making it hard to know what to set
3. **The dialog doesn't show current limits** — Admin has no reference for what the current limit is when setting an override, so they don't know if they're increasing or decreasing

### Changes

**`src/components/admin/AdminLimitManager.tsx` — UserOverridesTab improvements:**

1. **Remove all `as any` casts** on `transaction_limits` queries (GlobalDefaultsTab too) since the table is in the generated types
2. **Show effective limits table** for the selected user — display all txn types with their current daily/monthly limits, indicating whether each comes from a global default or a custom override
3. **Inline edit capability** — Instead of only an "Add Override" dialog, allow admins to click on any limit row and directly type a new max amount/count. This makes increasing or decreasing limits intuitive (like the Global Defaults inline editing)
4. **Show current value in the dialog** — When opening the Add Override dialog, pre-populate or display the current global default so the admin knows what they're changing from
5. **Add "Reset to Default" button per row** — Quick way to remove a single override and revert to global

**`src/lib/dailyLimits.ts` & `src/hooks/use-usage-stats.ts`:**
- Already correctly resolve overrides → global defaults → hardcoded fallbacks. No changes needed here.

### UI Layout for Selected User
After selecting a user, show a table:
```text
Type           | Period  | Current Limit | Max Txns | Source  | Actions
Send Money     | Daily   | ৳50,000       | 40       | Default | [Edit] 
Send Money     | Monthly | ৳400,000      | 100      | Default | [Edit]
Cash Out       | Daily   | ৳20,000       | 10       | Custom  | [Edit] [Reset]
...
```
- Clicking [Edit] opens a small inline form or dialog pre-filled with current values
- "Custom" badge for overrides, "Default" badge for globals
- [Reset] removes the override, reverting to global default

### Technical Details
- Fetch `transaction_limits` (global defaults for `applies_to = 'user'`) when a user is selected
- Merge with `user_limit_overrides` to compute effective limits per txn_type + period
- Upsert logic remains the same (unique constraint on `target_user_id, txn_type, period`)
- All audit logging stays in place


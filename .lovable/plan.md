

## Show User Limits in Admin User Details Sheet

### Problem
The User Details sheet in AdminDashboard shows profile, roles, KYC, and transactions — but has no section for the user's transaction limits or any active limit overrides. Admins can't see what limits apply to a specific user without navigating to the Limit Manager tab separately.

### Changes

**`src/pages/AdminDashboard.tsx`**
1. In the `fetchDetailUser` function (or wherever `detailData` is populated), add a query to fetch:
   - Active `user_limit_overrides` for the user (`target_user_id = user.user_id, is_active = true`)
   - The global `transaction_limits` defaults (already fetched or can be fetched once)

2. Add a new "Transaction Limits" section in the User Details sheet (between KYC and Recent Transactions), displaying:
   - A table/list of all txn types (send, cashout, etc.) showing effective daily/monthly limits
   - Badge indicator when a user-specific override is active (e.g., "Custom" badge)
   - The override amount vs global default, so admin can see at a glance
   - A quick link/button to navigate to the User Overrides tab with this user pre-selected

3. Store the fetched overrides in `detailData.limitOverrides` alongside existing fields.

### UI Layout
Each limit row will show:
- Transaction type label
- Daily: effective amount (with "Custom" badge if override exists)
- Monthly: effective amount (with "Custom" badge if override exists)
- If no overrides exist, show "Using global defaults" message


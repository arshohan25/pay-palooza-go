

## Admin Limit Management System

### Overview
Build an admin module for managing transaction limits across users, merchants, and the system — supporting individual user overrides, bulk updates, and global default configuration.

### Current State
- Limits are **hardcoded** in `src/lib/dailyLimits.ts` and `src/pages/LimitsPage.tsx` (e.g., Send Money: ৳50,000/day, ৳400,000/month)
- No database table exists for configurable limits
- No per-user or per-role limit overrides exist
- The admin dashboard has 24 nav tabs but no "Limits" tab

### Database Changes

**New table: `transaction_limits`** — stores the global default limits (one row per txn_type + period):
- `id`, `txn_type` (text), `period` ('daily'/'monthly'), `max_amount` (numeric), `max_count` (integer), `applies_to` (text: 'user'/'merchant'/'agent'), `is_active` (boolean), `updated_at`, `updated_by` (uuid)
- RLS: admin-only write, authenticated read

**New table: `user_limit_overrides`** — per-user/merchant/agent custom limits:
- `id`, `target_user_id` (uuid), `txn_type` (text), `period` ('daily'/'monthly'), `max_amount` (numeric, nullable), `max_count` (integer, nullable), `reason` (text), `set_by` (uuid), `expires_at` (timestamptz, nullable), `is_active` (boolean), `created_at`, `updated_at`
- RLS: admin write, users can read own overrides

### New Admin Component: `AdminLimitManager`

A new tab "Limits" in the admin dashboard with sub-tabs:

1. **Global Defaults** — Editable table of all txn types showing daily/monthly amount and count limits per role (user/merchant/agent). Inline editing with save.

2. **User Overrides** — Search by phone/name, view a user's effective limits, set custom overrides (higher or lower) with reason and optional expiry. Shows existing overrides with ability to remove.

3. **Bulk Actions** — Apply limit changes to all users, all merchants, or all agents at once. Options: set a specific override, or reset all overrides to defaults.

### Code Changes

1. **Database migration**: Create `transaction_limits` and `user_limit_overrides` tables with RLS policies and seed default limit values matching current hardcoded ones.

2. **`src/components/admin/AdminLimitManager.tsx`** (new): Full admin UI with three sub-tabs (Global Defaults, User Overrides, Bulk Actions). Uses inline editing for global defaults, a user search + override dialog for individual limits, and bulk action controls.

3. **`src/pages/AdminDashboard.tsx`**: Add "Limits" nav item with `Scale` icon, import and render `AdminLimitManager` on the new tab.

4. **`src/lib/dailyLimits.ts`**: Refactor `checkDailyLimit` to first check `user_limit_overrides` for the current user, then fall back to `transaction_limits` table, then fall back to hardcoded defaults.

5. **`src/pages/LimitsPage.tsx`** and **`src/hooks/use-usage-stats.ts`**: Update to fetch limits from the database (`transaction_limits` + user overrides) instead of using hardcoded values.

### Key Features
- Admin can view/edit global default limits for each transaction type, period, and role
- Admin can set per-user custom limits (with reason and optional expiry)
- Admin can bulk-apply limit overrides to all users/merchants/agents or reset them
- Users see their effective limits (override or default) on their Limits page
- Audit logging for all limit changes


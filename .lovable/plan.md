

# User Usage Performance Tracker & Rewards System

## What You Want
A dedicated admin module that shows each user's usage performance metrics (transaction volume, frequency, spending patterns, account age, activity score) and lets admins reward high-performing users with extra features, coupons, discounts, and special offers — all based on their usage data.

## New Components & Changes

### 1. Database: `user_rewards` table (migration)
Stores rewards/offers assigned to specific users by admins:
- `id`, `user_id` (references profiles), `reward_type` (enum: `coupon`, `feature_unlock`, `discount`, `bonus_balance`, `custom_offer`)
- `reward_value` (JSON — coupon code, feature key, discount %, bonus amount, etc.)
- `reason` (text — e.g. "Power user reward", "Top 10 transactor")
- `status` (active / claimed / expired)
- `expires_at`, `created_by` (admin), `created_at`
- RLS: admins full access, users can read own rows

### 2. New Admin Component: `AdminUserPerformanceTracker.tsx`
A full-page admin panel with:

**Performance Dashboard (top section)**
- Summary cards: Total users by badge (New/Basic/Active/Power), avg transactions/user, top spenders
- Search bar to find users by phone/name

**User Performance Table**
- Columns: User (phone + name), Badge, Account Age, Total Txns, Monthly Txns, Total Volume (৳), Last Active, Activity Score
- Sortable by any column, filterable by badge
- Each row expandable to show transaction breakdown by type (send/cashout/recharge etc.)

**Reward Actions (per user or bulk)**
- Select users → "Reward" button opens a dialog with options:
  - **Assign Coupon**: Pick from existing coupons or create a one-time coupon for this user
  - **Unlock Feature**: Grant access to a hidden/disabled feature
  - **Give Discount**: Set a % or flat discount on next N transactions
  - **Bonus Offer**: Custom text-based offer with expiry
- Bulk selection: select multiple users by badge filter (e.g. "All Power users") and apply reward to all

**Reward History Tab**
- Table of all issued rewards with user, type, value, status, issued date

### 3. User-Facing: Rewards Inbox on Account Page
- New "My Rewards" section showing active rewards/offers assigned to the user
- Claimable coupons auto-populate in checkout coupon field
- Feature unlocks take effect immediately via existing override system

### 4. Integration Points
- Feature unlocks use existing `user_feature_overrides` table (inserts a `visible` override for the user)
- Coupon rewards create a user-specific entry linking to `coupons` table
- Activity score computed from existing `transactions` + `profiles` data (reuses `get_user_usage_badge` logic but with more granular metrics)

## Files Changed
- **Migration SQL** — `user_rewards` table + RLS + enum type
- **New**: `src/components/admin/AdminUserPerformanceTracker.tsx` — main admin panel
- **Edit**: `src/pages/AdminDashboard.tsx` — add new section/nav item for "User Performance"
- **Edit**: `src/pages/AccountPage.tsx` — add "My Rewards" section for users
- **Edit**: `src/pages/ShopCheckoutPage.tsx` — auto-apply user-specific coupon rewards

## Technical Details
- Performance metrics computed client-side from `transactions` table aggregation (grouped by user_id via admin RPC)
- New RPC `get_user_performance_stats` returns aggregated metrics for admin view (bypasses row-per-user RLS)
- Reward assignment logged in `audit_logs` for compliance
- Existing `get_user_usage_badge` RPC reused for badge classification


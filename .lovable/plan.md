

# Enhance Reward History Log

## Current State
The "Reward History" tab already exists with basic columns: User, Type, Value, Reason, Status, and Issued date. However, it lacks filtering, search, per-user drill-down, status management, and admin identity tracking.

## Enhancements

### 1. Add search & filter controls to Reward History tab
- Search by phone/name
- Filter by reward type (coupon, feature_unlock, discount, bonus_balance, custom_offer)
- Filter by status (active, claimed, expired, revoked)
- Date range filter (from/to)

### 2. Show assigned-by admin name
- Join `created_by` with profiles to display admin name/phone instead of raw UUID
- Show in a new "Assigned By" column

### 3. Add expiry column
- Show `expires_at` date, highlight expired rewards in red

### 4. Add status management actions
- Button to revoke an active reward (sets status to "revoked")
- Visual indicators: green for active, gray for claimed, red for expired/revoked

### 5. Per-user reward history in expanded row
- In the Performance tab, when a user row is expanded, show their individual reward history with timestamps instead of just a count

### 6. Pagination
- Show 20 rewards per page with prev/next controls

## File Changed
- `src/components/admin/AdminUserPerformanceTracker.tsx` — Enhance Reward History tab with filters, admin name resolution, expiry display, revoke action, per-user expanded history, and pagination


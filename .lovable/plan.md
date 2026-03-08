

## Plan: Bulk Limit Editing + Usage Progress Bars

### 1. Bulk Limit Editing — Select Multiple Users (AdminLimitManager.tsx)

**Current state:** The Bulk Actions tab applies overrides to ALL users/merchants/agents of a role. There's no way to select specific users.

**Changes to `BulkActionsTab` in `src/components/admin/AdminLimitManager.tsx`:**

- Add a user search + multi-select UI at the top of the Bulk Actions tab
- Admin searches users by name/phone, results appear as checkable rows
- Selected users show as chips/badges with remove option
- The existing txn_type/period/amount/count form stays the same
- "Apply to Selected" button upserts overrides only for checked users (instead of all)
- Keep existing "Apply to All" as a secondary action
- Add a confirmation step showing: "Apply Send Money daily limit ৳X to N users?"

### 2. Usage Progress Bars — User Details Sheet (AdminDashboard.tsx)

**Current state:** The Transaction Limits section in the User Details sheet shows limit values but no usage data.

**Changes to the Transaction Limits section in `src/pages/AdminDashboard.tsx`:**

- After opening User Details, fetch the user's transactions for the current day and month (same logic as `useUsageStats` but for a target user)
- Add a helper function `fetchUserUsage(userId)` that queries `transactions` table for the user's completed transactions this month, then splits into daily/monthly buckets
- For each limit row (e.g., "Send Money Daily ৳50,000"), show a progress bar:
  - Bar fill = `usedAmount / limitAmount * 100`
  - Label: "৳12,000 / ৳50,000 used (24%)" and "5 / 40 txns"
  - Color: green (<60%), yellow (60-85%), red (>85%)
- Progress bar uses the existing `Progress` component from `src/components/ui/progress.tsx`
- Usage data loads alongside `fetchUserDetails` when a user is selected

### Files Modified
- `src/components/admin/AdminLimitManager.tsx` — BulkActionsTab: add multi-user search+select
- `src/pages/AdminDashboard.tsx` — Transaction Limits section: add usage fetch + progress bars


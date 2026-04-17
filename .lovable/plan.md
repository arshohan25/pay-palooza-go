
## Make AdminUserMetrics Cards Clickable & Filter-Linked

Each of the ~40 metric cards in `AdminUserMetrics` should act as a filter shortcut into the existing user list / related admin tabs, so admins can drill from a number → the actual underlying users/records.

### Approach

1. **Add a `filter` query-param convention** on `/admin#users` that the existing user list (in `AdminDashboard.tsx` Users tab) reads and applies. Filter keys map 1:1 to each metric card.

2. **Wrap each metric card** in `AdminUserMetrics.tsx` with a button/onClick that navigates to the right destination:
   - Most cards → `/admin?filter=<key>#users` (filters the user table)
   - Cross-module cards → jump to the relevant admin tab (e.g. KYC Pending → `#kyc`, Fraud Alerts → `#risk`, Coupons Used → `#marketing`, Referrals → `#referrals`)

3. **Implement the filter layer in the Users tab**:
   - Read `?filter=` from URL on mount + on change
   - Apply a predicate over the already-fetched `users` array (no extra queries needed for most filters)
   - Show an active "Filter: <label> — Clear" chip above the user table

### Card → Filter Mapping (key examples)

| Card | Action |
|---|---|
| Total Users | clear filter |
| Active Today / 7d / 30d | filter users with txn in window |
| Inactive 30d / Dormant 90d | inverse of above |
| New Today / This Week / Month | `created_at` window |
| Suspended / Deleted | `status` filter |
| KYC Verified / Pending / Rejected / Not Started / Exempt | jump to `#kyc` with sub-filter, or filter users by `kyc_status` |
| Send Money users / Cash Out / Recharge / Pay Bill / Bank Transfer (30d) | filter to users who did that txn type in 30d |
| Coupons Used | jump to `#marketing` coupons sub-tab |
| Referrals Made | jump to `#referrals` |
| Rewards Earned | jump to `#user-tracker` |
| Fraud Alerts / Blocked / High Risk | jump to `#risk` |

### Files Touched

- **`src/components/admin/AdminUserMetrics.tsx`** — accept an `onCardClick(filterKey)` prop; wrap each `Card` in a clickable wrapper with hover state, cursor-pointer, and keyboard a11y.
- **`src/pages/AdminDashboard.tsx`** — 
  - pass `onCardClick` handler that either sets a local `usersFilter` state + updates URL `?filter=`, or calls `setActiveTab` for cross-tab cards
  - in the Users tab, apply the filter predicate to the users list and render an "Active filter" chip with Clear button
  - read `?filter=` from `useSearchParams` on mount

### UX Details

- Hover: subtle ring + scale (matches existing premium glass aesthetic)
- Cursor pointer + `role="button"` + `tabIndex={0}` + Enter/Space handler
- Active filter chip uses emerald accent (matches brand)
- Clearing the filter removes the URL param

### Out of Scope

- No new DB queries, no new tables, no schema changes
- No changes to metric calculation logic — purely additive interaction layer

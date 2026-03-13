## Add User Monitoring Dashboard to Admin

A new "Monitor" tab in the admin dashboard that lets admins search and track specific users' Add Money and Send/Transfer activity with charts and balance summary sheets.

### What Gets Built

1. **New nav item**: "Monitor" tab with an Eye/TrendingUp icon in the admin sidebar
2. **User Search & Watchlist**: Search users by phone/name, add them to a monitoring view (session-local, no new DB table needed — uses existing `profiles` and `transactions` tables)
3. **Per-User Monitoring Sheet** (bottom sheet on tap):
  - Current balance display
  - Total Add Money amount (sum of `addmoney` transactions)
  - Total Transfer/Send amount (sum of `send` transactions)
  - Last 30 days activity chart (Recharts `AreaChart`) showing daily Add Money vs Send Money volumes
  - Recent transaction list filtered to these two types
4. **Multi-User Comparison View**: Summary cards for all monitored users showing balance, add money total, and send total side-by-side
5. It should auto come users who adding money on EasyPay and transfer money from EasyPay to others

### Technical Approach

**New file: `src/components/admin/AdminUserMonitor.tsx**`

- Search input querying `profiles` table by phone/name
- On selecting a user, fetch their `transactions` filtered to `type in ('addmoney', 'send')` 
- Group by date for chart data using `date-fns`
- Display via Recharts `AreaChart` (already installed)
- Balance and totals shown in summary cards
- Detail sheet using existing `Sheet` component

**Edit: `src/pages/AdminDashboard.tsx**`

- Add `{ id: "monitor", label: "Monitor", icon: Eye }` to `NAV_ITEMS`
- Import and render `AdminUserMonitor` for the monitor tab
- No database changes needed — all data comes from existing `profiles` and `transactions` tables with existing admin RLS policies
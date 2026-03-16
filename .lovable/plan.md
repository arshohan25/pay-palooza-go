

## Add Missing Essential Admin Dashboard Modules

### Gap Analysis

After auditing every component and nav entry, here are the critical gaps:

**A. Components that EXIST but are NOT wired into the dashboard:**

| Component | Purpose |
|-----------|---------|
| `AdminMerchantApplications.tsx` | Review/approve/reject merchant applications |
| `AdminApiRequests.tsx` | Review/approve API key requests from merchants |
| `TeamActivityDashboard.tsx` | Team performance metrics, login history, activity feed |

**B. Modules that DON'T EXIST but are essential for an MFS admin panel:**

| Module | Purpose |
|--------|---------|
| `AdminDistributorManagement.tsx` | Manage distributors (the `distributors` table exists but has no admin UI) — list, status toggle, float/commission view, territory management |
| `AdminSystemHealth.tsx` | System health overview — edge function status, DB connection, realtime channel health, error rate trends, uptime indicator |
| `AdminDataExport.tsx` | Centralized export center — export users, transactions, agents, merchants, distributors, audit logs as CSV with date range filters |
| `AdminUserSessions.tsx` | Login session tracker — recent logins from `audit_logs`, device info, IP patterns, suspicious login alerts |

### Implementation Plan

#### 1. Wire 3 existing unwired components
- Add `merchant_apps`, `api_requests` to **Operations** nav group
- Add `team_activity` to **Other** nav group
- Import components and add render blocks in `AdminDashboard.tsx`

#### 2. Create AdminDistributorManagement.tsx
- List all distributors from `distributors` table
- Show business_name, territory, commission_rate, max_float, status
- Toggle active/suspended status
- View linked agents (via `parent_id` in agents table)
- Add to **Network** nav group

#### 3. Create AdminSystemHealth.tsx
- Edge function health check via `check-api-status` function
- Realtime channel status (already have `useRealtimeStatus`)
- Recent errors from `audit_logs` where action contains 'error' or 'fail'
- Summary cards: Uptime, Active Channels, Error Rate, Last Deploy
- Add to **System** nav group

#### 4. Create AdminDataExport.tsx
- Unified export center with entity selector (Users, Transactions, Agents, Merchants, Distributors, Audit Logs)
- Date range picker for filtering
- CSV download with progress indicator
- Add to **Reports** nav group

#### 5. Create AdminUserSessions.tsx
- Recent login events from `audit_logs` (action = 'login', 'admin_login', etc.)
- Device registration cross-reference from `device_registrations`
- Suspicious pattern detection (multiple devices, unusual times)
- Add to **System** nav group

### Files Changed

| File | Action |
|------|--------|
| `src/components/admin/AdminDistributorManagement.tsx` | **Create** — Distributor CRUD + status management |
| `src/components/admin/AdminSystemHealth.tsx` | **Create** — System health monitoring |
| `src/components/admin/AdminDataExport.tsx` | **Create** — Centralized CSV export center |
| `src/components/admin/AdminUserSessions.tsx` | **Create** — Login session tracking |
| `src/pages/AdminDashboard.tsx` | **Edit** — Wire all 7 modules (3 existing + 4 new) into nav + imports |

No database migrations needed — all modules use existing tables (`distributors`, `audit_logs`, `device_registrations`, `profiles`, `transactions`, `agents`, `merchants`, `merchant_applications`, `api_access_requests`).


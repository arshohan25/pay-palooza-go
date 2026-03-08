

## Plan: Team Member Activity Log Timeline

### Overview
Create a new `TeamActivityLog` component that displays a per-member timeline of logins, password changes, and permission updates. Add it as a 4th tab ("Activity Log") in `AdminTeamManagement.tsx`.

### 1. New Component: `src/components/admin/TeamActivityLog.tsx`

**Data source:** Query `audit_logs` table filtered to team member user IDs, with actions relevant to team activity:
- `admin_login` — login events
- `password_change` / password-related actions
- `team_permission_update` / permission-related actions
- Other team-related actions (e.g., `team_member_update`, `team_availability_toggle`)

**UI:**
- **Filter bar**: Select specific team member (dropdown) + date range filter
- **Timeline view**: Vertical timeline with colored icons per event type:
  - 🟢 Login → green dot/icon
  - 🔑 Password change → amber dot/icon  
  - 🛡️ Permission update → blue dot/icon
  - ⚙️ Other actions → gray dot/icon
- Each entry shows: member name, action description (humanized), timestamp (relative + absolute)
- Realtime subscription on `audit_logs` for live updates

### 2. Update `src/components/admin/AdminTeamManagement.tsx`

- Add 4th tab: "Activity Log"
- Change grid-cols-3 → grid-cols-4
- Import and render `TeamActivityLog` in the new `TabsContent`

### 3. Ensure Audit Log Entries Exist

The existing code already logs `admin_login` events. Password changes are tracked in `TeamLoginPage.tsx`. Permission updates in `AdminTeamManagement` — verify these write to `audit_logs` and add logging if missing.

### Files
- **New**: `src/components/admin/TeamActivityLog.tsx`
- **Modified**: `src/components/admin/AdminTeamManagement.tsx` (add tab)


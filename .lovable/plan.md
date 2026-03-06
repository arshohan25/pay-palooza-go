

## Plan: Add Audit Log Viewer Tab to Admin Dashboard

### What this does
Adds a new "Audit Log" tab in the admin dashboard sidebar that displays `view_user_profile` and `view_all_profiles` events from the `audit_logs` table, with filters for date range and admin actor.

### Changes

#### 1. Create `src/components/admin/AdminAuditLogViewer.tsx`
A new component that:
- Fetches audit logs filtered by `action IN ('view_user_profile', 'view_all_profiles')` from the `audit_logs` table
- Displays them in a table with columns: Date/Time, Admin (actor_id), Action, Target User (from details JSONB), Details
- Includes a date range filter using two date pickers (from/to)
- Includes an admin filter dropdown (populated from distinct actor_ids in the results, resolved to profile names)
- Supports refresh and pagination (load more)
- Uses existing UI components: Table, Card, Button, Popover, Calendar, Select, Badge

#### 2. Update `src/pages/AdminDashboard.tsx`
- Add `{ id: "auditlog", label: "Audit Log", icon: Eye }` to `NAV_ITEMS` array (using the already-imported `Eye` icon)
- Import `AdminAuditLogViewer`
- Add `{activeTab === "auditlog" && <AdminAuditLogViewer />}` in the tab content section

### No database changes needed
The `audit_logs` table already exists with appropriate RLS policies allowing admin SELECT access.

### Files modified
- `src/components/admin/AdminAuditLogViewer.tsx` (new)
- `src/pages/AdminDashboard.tsx` (2 small additions)


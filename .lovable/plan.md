

## Plan: Soft-Delete, Grace Period & Bulk User Management

### 1. Database Changes

**Add soft-delete columns to `profiles` table:**
- `deactivated_at` (timestamptz, nullable) — when soft-delete was triggered
- `scheduled_deletion_at` (timestamptz, nullable) — grace period expiry (e.g. 30 days after deactivation)
- `deactivated_by` (uuid, nullable) — admin who initiated

**No new tables needed** — the existing `status` field already supports "suspended"; we add a new status value "deactivated" for soft-deleted users.

### 2. Edge Function: `soft-delete-user`

New edge function that:
- Verifies admin role via JWT
- Sets profile status to "deactivated", records `deactivated_at = now()`, `scheduled_deletion_at = now() + 30 days`, `deactivated_by = caller.id`
- Logs action in `audit_logs`
- Does NOT delete auth user or data

### 3. Update `delete-user` Edge Function

- Add a check: if user is not yet past `scheduled_deletion_at`, reject hard-delete (unless admin force-overrides with `force: true` param)
- Keep existing cascading hard-delete logic

### 4. Scheduled Cleanup (Optional Cron)

- A `pg_cron` job that runs daily, calling a DB function to find profiles where `status = 'deactivated'` AND `scheduled_deletion_at < now()`, then invokes the hard-delete edge function or directly cascades cleanup via a SECURITY DEFINER function

### 5. Admin UI Changes in `AdminDashboard.tsx`

**Bulk actions toolbar** (appears when checkboxes are selected):
- Add a checkbox column to the users table header + each row
- State: `selectedUserIds: Set<string>`
- Toolbar shows: "X selected" with buttons for **Bulk Suspend**, **Bulk Deactivate (Soft Delete)**, **Bulk Hard Delete**, **Export Selected (CSV)**

**Per-row changes:**
- Rename current "Delete" button to "Hard Delete"
- Add "Deactivate" button (soft-delete) — sets 30-day grace period
- Show `deactivated` status badge in orange/warning color
- For deactivated users: show "Reactivate" and "Delete Now" buttons, plus remaining grace period days

**Bulk Export:**
- Generate CSV from selected users (name, phone, balance, status, created_at)
- Download via browser `Blob` + `URL.createObjectURL`

### 6. Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Add `deactivated_at`, `scheduled_deletion_at`, `deactivated_by` columns to `profiles` |
| `supabase/functions/soft-delete-user/index.ts` | New edge function for soft-delete |
| `supabase/functions/delete-user/index.ts` | Add grace period check |
| `src/pages/AdminDashboard.tsx` | Checkbox selection, bulk action toolbar, soft-delete button, CSV export, updated status badges |
| `src/hooks/use-admin.ts` | Add `bulkSuspendUsers`, `softDeleteUser` helpers |

### Technical Notes

- Bulk suspend uses existing `toggleUserStatus` in a loop with `Promise.allSettled` for resilience
- Bulk hard-delete calls the `delete-user` edge function sequentially (to respect FK ordering)
- CSV export is client-side only, no server round-trip needed
- The soft-delete grace period (30 days) will be visible in the UI as "Deletion in X days"
- Deactivated users should be blocked at login via the existing `status` check in the auth flow


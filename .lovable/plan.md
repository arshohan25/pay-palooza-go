

## Limit Changes Audit Trail

### Overview
Add a 5th tab "Audit Trail" to the `AdminLimitManager` component that queries `audit_logs` for limit-related actions and displays them in a filterable, chronological table.

### Changes

**1. `src/components/admin/AdminLimitManager.tsx`**
- Update `grid-cols-4` to `grid-cols-5`
- Add "Audit Trail" tab with `History` icon
- Add new `LimitAuditTab` component that:
  - Fetches from `audit_logs` where `action` matches limit-related actions: `bulk_limit_override`, `bulk_limit_reset`, `limit_override_created`, `limit_override_removed`, `limit_updated`
  - Also fetches from `user_limit_overrides` recent changes (by `updated_at`) to show individual override activity
  - Resolves actor IDs to profile names via a profiles lookup
  - Displays a table with columns: Date/Time, Admin, Action, Details (txn type, period, amounts, target user, reason)
  - Filterable by action type and date range
  - Shows last 100 entries, sorted newest first

**2. Update existing actions to log audit entries**
- `GlobalDefaultsTab.handleSave`: Insert audit log with action `limit_updated`, capturing old/new values
- `UserOverridesTab.addOverride`: Insert audit log with action `limit_override_created`
- `UserOverridesTab.removeOverride`: Insert audit log with action `limit_override_removed`
- (Bulk actions already log to `audit_logs`)

No database changes needed — uses existing `audit_logs` table.


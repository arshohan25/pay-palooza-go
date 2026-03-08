

## Plan: Bulk Toggle + Disabled Counter Badge

### 1. Add bulk enable/disable buttons to `AdminGlobalToggles` (`src/components/admin/AdminGlobalToggles.tsx`)

- Compute `disabledCount` and `enabledCount` from toggles array
- Add a disabled counter badge next to the title (e.g., red badge showing "3 disabled")
- Add two bulk action buttons in the header area: "Enable All" and "Disable All"
  - Each updates all rows in `global_feature_toggles` by iterating and setting `is_enabled` to `true`/`false`
  - Show confirmation via AlertDialog before bulk operations
  - Buttons are disabled when all are already in that state
- Use `Promise.all` with individual updates per row (Supabase doesn't support bulk update without filter easily, but we can use `.neq("is_enabled", targetValue)` to only update needed rows)

### 2. Add disabled counter badge on the admin tab button (`src/pages/AdminDashboard.tsx`)

- Fetch disabled toggle count from `global_feature_toggles` where `is_enabled = false`
- Show a small red badge on the "Toggles" tab with the count of disabled features
- Subscribe to realtime changes to keep the count updated

### Files Modified
- `src/components/admin/AdminGlobalToggles.tsx` — bulk enable/disable buttons, inline disabled counter badge
- `src/pages/AdminDashboard.tsx` — disabled count badge on the "Toggles" tab


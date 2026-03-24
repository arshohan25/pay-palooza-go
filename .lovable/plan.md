

## Fix: Platform Bank List showing under all inner tabs

### Problem
`AdminBankListManager` is rendered as a sibling **after** the `AdminSystemSettings` component in `AdminDashboard.tsx` (line 1758). This means it always appears below the System Settings tabs regardless of which inner tab (App Config, Currency, Fee Rules, etc.) is selected.

### Solution
Move `AdminBankListManager` inside the `AdminSystemSettings` component as a **6th tab** called "Banks". This keeps it scoped to its own tab instead of always visible.

### Changes

**File: `src/components/admin/AdminSystemSettings.tsx`**
- Add import for `AdminBankListManager`
- Add a 6th tab trigger: "Banks"
- Add corresponding `TabsContent` rendering `AdminBankListManager`
- Update grid from `grid-cols-5` to `grid-cols-6`

**File: `src/pages/AdminDashboard.tsx`**
- Remove `AdminBankListManager` from the `sys_settings` block (line 1758)
- Remove its import if no longer used elsewhere


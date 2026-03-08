

## Add Inline Limit Editor to Admin User Details Sheet

### Overview
Replace the read-only Transaction Limits grid in the User Details sheet with an interactive editor. Each limit row gets an "Edit" button that opens an inline edit mode showing old vs new values side-by-side before confirming.

### Changes

**`src/pages/AdminDashboard.tsx` — Transaction Limits section (lines ~1392-1468):**

1. **Add state** for inline editing: `editingLimit` tracking `{ txnType, period, oldAmount, oldCount, newAmount, newCount }` or null
2. **Replace "Manage →" button** with "Edit Limits" that stays in the sheet (keep the navigate link as secondary)
3. **Add edit icon per row** — clicking a row's edit button enters inline edit mode for that txn_type+period
4. **Comparison UI** — When editing, show:
   - Old value (struck through or dimmed) → New value (highlighted input)
   - Example: `৳50,000` → `[input field]`
5. **Save button** — Upserts to `user_limit_overrides` with the user's ID, shows toast on success, refreshes detailData
6. **Reset to Default** — Per-row button to deactivate the override (set `is_active: false`)

### UI Layout (Edit Mode for a Row)
```text
Send Money (Daily)
  Current: ৳50,000 (Default)
  New Amount: [________] 
  New Max Txns: [________]
  [Cancel] [Save Override]
```

### Technical Details
- Upsert uses `onConflict: "target_user_id,txn_type,period"` on `user_limit_overrides`
- After save, re-fetch via `fetchUserDetails(detailUser.user_id)` to refresh the sheet
- Audit log entry with `{ previous, new_value }` in details
- Session check for `set_by` field (required NOT NULL)

### Files Modified
- `src/pages/AdminDashboard.tsx` — Transaction Limits section in User Details sheet


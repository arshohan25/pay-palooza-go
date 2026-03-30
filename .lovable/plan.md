

# Add Bulk Toggle Actions to Feature Access Panel

## What Changes
Add a bulk action toolbar to the **By Badge** and **By Role** tabs that lets admins:
1. Select multiple features via checkboxes
2. Pick a target badge/role column
3. Apply a single visibility value (Visible / Disabled / Hidden / Default) to all selected features at once

## UI Design
- Add a checkbox column on the left of each feature row + a "Select All" checkbox in the header
- When 1+ features are selected, show a sticky toolbar above the table with:
  - Selected count label (e.g. "4 selected")
  - A `Select` for target group (badge or role column)
  - A `Select` for visibility value
  - An "Apply" button
  - A "Clear" button to deselect all

## Implementation — `src/components/admin/AdminUserFeatureAccess.tsx`

1. **New state**: `selectedFeatures: Set<string>` for checked feature keys
2. **Checkbox column**: Add `Checkbox` import, render in each row + header (select all toggle)
3. **Bulk toolbar**: Rendered conditionally when `selectedFeatures.size > 0`, contains group selector, visibility selector, and Apply button
4. **Bulk apply function**: Loops through selected feature keys, calls `setGroupVis()` for each, then clears selection. Uses `Promise.all` for parallel upserts.
5. Apply the same pattern to both Badge and Role tabs (shared `renderGroupGrid` already handles both — just parameterize the bulk state per active tab)

## Files Changed
- `src/components/admin/AdminUserFeatureAccess.tsx` — Add checkbox column, bulk toolbar, and bulk apply logic


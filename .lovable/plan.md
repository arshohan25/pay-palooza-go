

## Admin Dashboard Drag & Drop Navigation Reordering

### Summary
Enable admins to drag-and-drop reorder both **nav groups** (sections) and **individual items within groups** in the sidebar. The custom order persists in localStorage so it survives reloads.

### Approach

1. **Convert `NAV_GROUPS` from a constant to state** — initialize from localStorage (key: `admin_nav_order`), falling back to the default `NAV_GROUPS` definition.

2. **Create `AdminNavReorder` component** — a modal/sheet with two levels of drag-and-drop using `@dnd-kit` (already in the project):
   - **Outer sortable**: Reorder entire groups (Overview, Operations, etc.)
   - **Inner sortable**: Reorder items within each group
   - "Reset to Default" button to restore original order
   - "Save" button that writes to localStorage and closes

3. **Add "Rearrange" toggle button** in sidebar header — pencil/grip icon that opens the reorder modal.

4. **Persist order in localStorage** — store as JSON array of `{ label, items: string[] }`. On load, merge with the master `NAV_GROUPS` to handle any new items added in future updates (new items append to their default group).

### Technical Details

- Uses nested `DndContext` + `SortableContext` from `@dnd-kit` (already a dependency)
- `DEFAULT_NAV_GROUPS` remains as the immutable reference
- `navGroups` state in `AdminDashboard` is the live, reorderable copy
- `NAV_ITEMS` is derived from `navGroups` instead of `NAV_GROUPS`
- The reorder UI shows group headers as draggable cards, with nested draggable items inside each

### Files Modified
1. `src/components/admin/AdminNavReorder.tsx` — new component with nested drag-and-drop UI
2. `src/pages/AdminDashboard.tsx` — convert `NAV_GROUPS` to state, add rearrange button, import reorder component


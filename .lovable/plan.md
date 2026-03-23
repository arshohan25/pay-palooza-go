

## Drag & Drop Reorderable Analytics Charts

### Summary
Make the 8 analytics chart cards in the Admin Overview tab drag-and-drop reorderable. The custom order persists in localStorage.

### Approach

1. **Define chart panel IDs** — assign each of the 8 chart cards a stable ID (e.g., `txn_volume`, `cumulative`, `type_breakdown`, `revenue_fees`, `signups`, `active_hours`, `success_ratio`, `growth`).

2. **Add sortable state** — wrap the grid in a `DndContext` + `SortableContext` from `@dnd-kit`. Each chart card becomes a sortable item with a small drag handle in the card header.

3. **Refactor chart rendering** — extract each chart into a keyed render function/map so they can be rendered in dynamic order based on the `panelOrder` state array.

4. **Persist order** — save the array of panel IDs to `localStorage` (key: `admin_chart_order`). Load on mount, falling back to the default order.

5. **Reset button** — add a small "Reset layout" button next to the period toggle.

### Technical Details

- Uses `@dnd-kit/core` + `@dnd-kit/sortable` (already installed)
- Each card wrapped in a `SortableChartCard` component that adds a `GripVertical` drag handle
- The grid layout (`grid md:grid-cols-2`) is preserved; only the order of children changes
- localStorage key: `admin_chart_order`, stores `string[]` of panel IDs

### File Modified
1. `src/components/admin/AdminOverviewCharts.tsx` — add drag-and-drop sorting to the chart grid


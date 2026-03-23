

## Drag & Drop Panel Reordering for Team Activity and System Health Tabs

### Summary
Add drag-and-drop reorderable panels to **TeamActivityDashboard** and **AdminSystemHealth**, matching the existing pattern from `AdminOverviewCharts`. Each component gets sortable sections with grip handles and localStorage persistence.

### Components to Update

**1. TeamActivityDashboard.tsx** — 4 reorderable panels:
- `summary_cards` — the 4 stat cards (Total Team, Online, Actions Today, Open Tickets)
- `performance_table` — Team Performance table with department filter
- `activity_feed` — Recent Activity card
- `login_history` — Login History card

Wrap in `DndContext` + `SortableContext`. Each panel gets a `SortablePanel` wrapper with `GripVertical` handle. Persist order to `localStorage` key `admin_team_panel_order`. Add "Reset layout" button.

**2. AdminSystemHealth.tsx** — 3 reorderable panels:
- `health_checks` — the status cards grid (System + individual checks)
- `recent_errors` — Recent Errors card

Only 2 distinct sections here, so add a third by splitting or keeping it simple with just the 2 sortable panels. Persist to `localStorage` key `admin_health_panel_order`. Add "Reset layout" button.

### Technical Approach
- Extract a shared `SortablePanel` wrapper (same pattern as `SortableChartCard` in AdminOverviewCharts) — or inline it per component to keep changes minimal
- Use `@dnd-kit/core` + `@dnd-kit/sortable` with `verticalListSortingStrategy` (panels are stacked vertically)
- Each panel rendered via a `Record<string, ReactNode>` map, iterated in order from state array
- Grip handle visible on hover in the card/section header
- "Reset layout" button appears only when order differs from default

### Files Modified
1. `src/components/admin/TeamActivityDashboard.tsx` — wrap 4 panels in DnD context with sortable order + persistence
2. `src/components/admin/AdminSystemHealth.tsx` — wrap 2 panels in DnD context with sortable order + persistence


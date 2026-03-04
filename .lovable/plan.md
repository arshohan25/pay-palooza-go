

## Add Filtering to Activity Feed

### Changes to `src/components/admin/AdminActivityFeed.tsx`

Add two filter states and a compact filter bar between the header and the scroll area:

**1. Table filter** — A row of small toggle chips (one per table from `TABLE_META`), each showing the table's icon and label. Clicking toggles that table on/off. All active by default.

**2. Event type filter** — Three small toggle chips: "New" (INSERT), "Updated" (UPDATE), "Removed" (DELETE). All active by default.

**3. Filtered display** — Apply both filters to `events` before rendering via `useMemo`. The empty state message updates to differentiate "no events yet" from "no events match filters".

**4. Layout** — The filter bar sits in a collapsible section toggled by a `Filter` icon button in the header (next to Clear). When expanded, it shows two rows of chips in a compact `px-3 py-2` area. This keeps the feed clean when filters aren't needed.

### Implementation Details

- Add `activeTablesFilter: Set<string>` and `activeEventTypes: Set<string>` state
- Filter chips use the existing `Button` component with `variant="outline"` / `variant="default"` toggle pattern, sized at `h-5 text-[10px]`
- Add a `Filter` icon import from lucide-react
- `filteredEvents = useMemo(() => events.filter(e => activeTables.has(e.table) && activeEventTypes.has(e.eventType)), [events, activeTables, activeEventTypes])`
- Count badge in header shows filtered count vs total when filters are active

### Files
- **Edit**: `src/components/admin/AdminActivityFeed.tsx` — all changes contained in this single file


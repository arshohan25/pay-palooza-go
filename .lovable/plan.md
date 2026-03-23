## Drag & Drop Reorderable and can be edit/change rules System Settings Tabs

### Summary

Make the 5 System Settings tabs (App Config, Currency, Fee Rules, Txn Rules, Maint.) drag-and-drop reorderable with localStorage persistence.

### Approach

1. **Define tab order as state** — store an array of tab objects `[{ id: "app", label: "App Config" }, ...]` in state, initialized from `localStorage` key `admin_system_tabs_order`.
2. **Replace static `TabsList**` — wrap tab triggers in a `DndContext` + `SortableContext` using `horizontalListSortingStrategy`. Each `TabsTrigger` gets wrapped in a sortable container.
3. **Persist & reset** — save order to localStorage on drag end. Add a small "Reset" button near the header when order differs from default.
4. **Tab content rendering** — `TabsContent` elements remain static (Radix handles visibility by `value`), only the trigger order changes.

### Technical Details

- Uses `@dnd-kit/core` + `@dnd-kit/sortable` with `horizontalListSortingStrategy`
- Each sortable trigger wraps a `TabsTrigger` inside a sortable div
- localStorage key: `admin_system_tabs_order`, stores `string[]` of tab IDs
- No changes to individual tab content components

### File Modified

1. `src/components/admin/AdminSystemSettings.tsx` — add DnD to tab triggers with persistence
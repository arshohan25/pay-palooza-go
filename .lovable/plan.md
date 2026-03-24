

## Plan: Redesign Activity Monitor Header & Filter Layout

### Changes — `AdminActivityMonitor.tsx`

**1. Move search, download, refresh into the header row (right side)**
- Combine the title line and the search/actions row into a single flex row
- Left side: icon + "Activity Monitor" title
- Right side: compact search input + download icon button + refresh icon button

**2. Redesign filter items with shared background + active highlight**
- Wrap each filter group (type filters, status filters) in a single `bg-muted/50 rounded-lg p-1` container
- Individual filter items become plain text buttons inside the container
- Active item gets `bg-background rounded-md shadow-sm text-foreground` (elevated look within the shared background — segmented control style)
- Inactive items stay as `text-muted-foreground` with no individual background

**3. Remove subtitle text** to keep the header compact since search now shares that row

### Visual Result
```text
┌────────────────────────────────────────────────────────────┐
│ [🔍] Activity Monitor          [search input] [⬇] [🔄]   │
│                                                            │
│ ┌─ bg-muted/50 rounded-lg ──────────────────────────────┐ │
│ │ [All] [Send] [Receive] [Cashout] ...                   │ │
│ └────────────────────────────────────────────────────────┘ │
│ ┌─ bg-muted/50 rounded-lg ──────────────────────────────┐ │
│ │ [All] [Completed] [Pending] [Failed] [Reversed]        │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### File Modified
- `src/components/admin/AdminActivityMonitor.tsx` — lines 159-217 (header + filters section)


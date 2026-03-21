

## Move Search Bar Inline with Filter Mode Toggle

### Change
Reposition the search bar from its own full-width row below the filter controls to sit **inline on the right side** of the Monthly/Custom Range toggle buttons. This creates a cleaner, more compact header with better use of horizontal space.

### Layout (before → after)
```text
BEFORE:
┌─────────────────────────────┐
│ [Monthly] [Custom Range]    │
│ ← March 2026 →             │
│ [This Month] [Last Month]  │
│ [🔍 Search by name...]     │  ← full-width row
│ 29 Txns | ৳135K | ৳93K     │
└─────────────────────────────┘

AFTER:
┌──────────────────────────────────┐
│ [Monthly] [Custom Range]  [🔍___]│  ← search moved inline
│ ← March 2026 →                  │
│ [This Month] [Last Month]       │
│ 29 Txns | ৳135K | ৳93K          │
└──────────────────────────────────┘
```

### Technical details in `src/pages/MerchantDashboard.tsx`

**Line 1471**: Change the mode toggle row from `flex gap-1.5 mb-3` to `flex items-center gap-1.5 mb-3` and add the search input as a right-aligned element inside it using `ml-auto`.

- The search input becomes a compact expandable field (~40% width) with rounded-full styling, sitting to the right of the toggle buttons.
- Remove the standalone search `div` block (lines 1528-1537).
- The search field uses a smaller placeholder on mobile ("Search...") to fit the compact space.

### Files modified
- `src/pages/MerchantDashboard.tsx`




# Make User Performance Tracker Responsive

## Changes

### 1. Reward History tab — mobile card layout
On mobile (`md:hidden`), replace the table with a stacked card list showing all fields vertically. Hide the table on mobile (`hidden md:block`).

### 2. Reward History filters — stack on mobile
Change the filter bar to use `grid grid-cols-2` on mobile so date inputs and selects don't overflow. Search spans full width.

### 3. Performance table — expanded row mobile fix
The per-user reward history items inside expanded rows use `flex-col` on small screens instead of horizontal flex.

### 4. Reward Dialog — full-width on mobile
Change dialog to `max-w-md w-[95vw]` so it doesn't clip on narrow screens.

### 5. Header — wrap on small screens
Make the title + refresh button wrap with `flex-wrap` so they don't overflow.

### 6. Pagination — compact on mobile
Already fine, just ensure text doesn't clip.

## File Changed
- `src/components/admin/AdminUserPerformanceTracker.tsx` — Add mobile card layout for reward history, responsive filter grid, mobile-friendly expanded rows and dialog


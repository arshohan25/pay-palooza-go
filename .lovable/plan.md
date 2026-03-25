

## Fix: API Keys Table Still Clipping

### Problem
From the screenshot, the "Reactivate" button is still cut off at the right edge. The `overflow-x-auto` wrapper exists but the parent `Card` component likely has `overflow: hidden` or the container above it constrains width. The table needs to scroll properly within its container.

### Solution

**File: `src/components/admin/AdminApiKeys.tsx`**

1. **Summary cards grid** — Change from fixed `grid-cols-3` to `grid-cols-1 sm:grid-cols-3` so cards stack on mobile
2. **Card wrapping the table** — Add `overflow-hidden` to the Card itself won't help; instead ensure the `overflow-x-auto` div has no width constraints. Add `rounded-lg` to the overflow div for visual consistency
3. **Mobile card layout** — For screens below `md`, replace the table with a stacked card layout per API key showing all info vertically. This is the proper responsive pattern rather than forcing horizontal scroll on small screens.

Specifically:
- Use a `hidden md:block` wrapper for the table view
- Use a `md:hidden` wrapper for a mobile card list view
- Each mobile card shows: merchant name, masked key with copy, env badge, status badge, permissions count, created date, and action buttons in a row
- Summary cards: `grid-cols-1 sm:grid-cols-3`

### Changes
- `src/components/admin/AdminApiKeys.tsx` — Add responsive mobile card layout alongside existing table, make summary cards responsive


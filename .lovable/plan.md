

## Fix: API Keys Table Cut-off

The problem is clear from the screenshot — the "Revoke"/"Reactivate" buttons are clipped on the right edge.

**Root cause**: At your viewport (1146px), after the sidebar (224px) and padding (~48px), the content area is roughly 874px wide. The table's `min-w-[950px]` forces it wider than the container, but the wrapping `Card` has `overflow-hidden` which clips instead of scrolling. The `overflow-x-auto` div inside should handle this, but the combination causes the clip.

### Changes

**1. `src/components/admin/AdminApiKeys.tsx`**
- Remove `overflow-hidden` from the Card wrapper — this is what's clipping the scroll container
- Keep `overflow-x-auto` on the inner div (this is correct)
- Increase table `min-w` from `950px` to `1050px` so horizontal scroll activates properly instead of trying to squeeze content
- Add `whitespace-nowrap` to the Created cell (not just the header)

**2. `src/pages/AdminDashboard.tsx`**  
- On the `<main>` element (line 1125), change `overflow-auto` to `overflow-y-auto overflow-x-hidden` — vertical scroll stays, but horizontal overflow is delegated to child scroll containers (the table's own `overflow-x-auto` div)
- This prevents double scrollbars while letting inner components handle their own horizontal scroll

This approach ensures the table scrolls horizontally within its own container without being clipped by parent elements.


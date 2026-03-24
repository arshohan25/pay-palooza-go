

## Plan: Redesign Activity Monitor to Match Reference

### Reference Analysis
The screenshot shows a clean, minimal design with:
- Section header: search icon + "Activity Monitor" title + subtitle below
- Full-width search input with search icon, download and refresh buttons aligned right
- Type filters as plain text labels in a row, with "All" shown as a small green filled circle/dot badge, others as plain text with no background
- Status filters same pattern — green dot for active "All", plain text for others

### Current vs Target
The current implementation uses `rounded-full` pill buttons with `bg-primary` or `bg-muted/50` backgrounds. The reference uses a much more minimal approach: just text labels, with the active "All" indicated by a small green dot/circle to its left rather than a filled background pill.

### Changes — `AdminActivityMonitor.tsx`

1. **Filter pills redesign**: Replace rounded-full background pills with plain text buttons. Active filter gets a small green dot indicator (like a bullet) to the left instead of a filled background. Non-active items are plain `text-muted-foreground` text.

2. **Search row**: Keep the current layout (search input + download + refresh icons) — it already matches the reference closely.

3. **Header**: Already matches. Keep as-is.

### File Modified
- `src/components/admin/AdminActivityMonitor.tsx` — lines ~186-217, redesign type and status filter rows


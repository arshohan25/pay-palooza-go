

## Compact Tab Bar & Active Color

### Changes — `src/components/admin/AdminGlobalToggles.tsx`

1. **Reduce tab spacing**: Change `gap-1` to `gap-0` in the tab container, reduce `px-3` to `px-2` on each tab button, and reduce icon/text gap from `gap-1.5` to `gap-1`
2. **Active tab color**: Change the active tab indicator from `bg-background` with border to `bg-primary text-primary-foreground` (solid colored highlight), and update text color for active state accordingly
3. **Remove ScrollArea wrapper** since tabs will now fit without scrolling — use a plain `div` with `flex flex-wrap` instead

### Result
- Tabs fit in one row without horizontal scroll
- Active/selected tab has a clear colored background (primary color)
- Compact, clean appearance


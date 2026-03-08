

## "More" as Inline Scroll — No Overlay

### What the User Wants
When tapping "More", instead of opening a separate overlay/bottom-sheet, the **homepage itself scrolls down** to reveal the More Services section inline — as if the content was always below and the page just scrolled to show it. No new page, no overlay, no backdrop.

### Changes

**`src/components/QuickActions.tsx`**
1. **Remove the full-screen overlay** (lines 494-594) — delete the `fixed inset-0` backdrop and the bottom-sheet container entirely.
2. **Replace with an inline expandable section** below the main grid:
   - When `expanded` is true, render the More Services grid **directly below** the Quick Actions card (not fixed/absolute — just normal document flow).
   - Use `AnimatePresence` + `motion.div` with `initial={{ height: 0, opacity: 0 }}` → `animate={{ height: "auto", opacity: 1 }}` for a smooth expand/collapse.
3. **Auto-scroll into view**: After expanding, use `scrollIntoView({ behavior: "smooth", block: "start" })` on the More Services section ref so the homepage smoothly scrolls down to reveal it — giving the "scroll down to up" feel.
4. **Toggle behavior**: Tapping "More" toggles `expanded`. The More icon rotates (ChevronUp) when expanded.
5. **Keep all existing More Services content**: same grid items, staggered animations, long-press tooltips, "Soon" badges, shimmer effects — just rendered inline instead of in an overlay.

### Visual Result
- Tap "More" → Quick Actions card expands, page smoothly scrolls down to show the additional services grid below
- Tap "More" again (or a collapse button) → section collapses back up
- No overlay, no backdrop, no separate layer — just the homepage expanding


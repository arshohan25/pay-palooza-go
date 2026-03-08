

## "More" Button — Full-Screen Overlay Instead of Inline Expand

### What Changes
When the user taps "More" in QuickActions, instead of expanding the grid inline, it opens a **full-screen modal overlay** that slides up from the bottom to the center of the screen (like a bottom sheet that covers most of the viewport).

### Changes

**`src/components/QuickActions.tsx`**
1. Remove the inline `AnimatePresence` expansion block (lines 489-587) — the "More Services" grid that expands within the card.
2. Change `handleAction` for `id === "more"`: instead of toggling `expanded`, set `expanded = true` (which will now control the overlay).
3. Add a **full-screen overlay** rendered via a portal or at the component root level:
   - Backdrop: `fixed inset-0 z-50 bg-black/40 backdrop-blur-sm`
   - Content panel: slides up from bottom, positioned centered vertically with `items-center justify-center`, rounded card with the "More Services" grid inside
   - Animation: `initial={{ y: "100%" }}` → `animate={{ y: 0 }}` with spring transition
   - Close button in the header + tap-on-backdrop to dismiss
   - Contains the same `visibleMoreServices` grid (4-column layout) with the existing staggered entrance animations, long-press tooltips, and "Soon" badges
4. Keep `expanded` state but now it controls overlay visibility instead of inline height

### Visual Result
- Tapping "More" opens a centered overlay/bottom-sheet covering ~60-70% of the screen
- The More Services grid appears inside with the same premium styling
- Tapping backdrop or close button dismisses it
- Smooth slide-up animation from bottom


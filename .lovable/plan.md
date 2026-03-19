

## Add "Chat with seller" label below the FAB

### What changes
**File: `src/pages/ProductDetailPage.tsx`** (lines 522-543)

Wrap the existing FAB button and a new text label in a flex column container. Add a small animated label reading "Chat with seller" beneath the circular button.

### Implementation

Replace the current `motion.button` block with a `motion.div` wrapper containing:
1. The existing FAB button (unchanged)
2. A small text label: `<span className="text-[10px] font-medium text-primary bg-card/90 backdrop-blur rounded-full px-2 py-0.5 shadow-sm whitespace-nowrap">Chat with seller</span>`

The wrapper will use `flex flex-col items-center gap-1` and inherit the same fixed positioning (`fixed bottom-20 right-4 z-[60]`). The button loses its fixed positioning since the parent handles it.

The entrance animation stays on the parent `motion.div`.


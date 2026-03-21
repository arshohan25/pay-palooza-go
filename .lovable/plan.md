

## Slow Down Products/Orders Overlay Animations

### What
The slide-up overlay and content fade animations are too fast. Increase durations for a smoother feel.

### Changes in `src/pages/MerchantDashboard.tsx`

1. **Line 453** — Overlay slide-up: change `duration: 0.45` → `duration: 0.65` (slower spring)
2. **Line 491** — Inner content fade-up: change `duration: 0.2` → `duration: 0.35`

### File Modified
- `src/pages/MerchantDashboard.tsx`




## Fix Scanner UI Layout

The scanner has several layout issues on the 384px viewport:

### Problems Identified
1. **Duplicate `pb` classes** on line 353: `pb-[env(safe-area-inset-bottom,16px)] px-6 pb-6` — Tailwind conflict, last one wins but intent is unclear
2. **Viewfinder overlay math assumes centered 260px box** but uses `calc(50% - 130px)` which doesn't account for the top bar pushing content down — the overlay cutout doesn't align with the actual viewfinder position
3. **Bottom controls too close to viewfinder** on short screens (605px viewport) — the `flex-1` center area + bottom controls can overlap or compress
4. **Help text can overlap** with bottom controls on small screens

### Fix Plan

**File: `src/components/QrScannerModal.tsx`**

1. **Fix duplicate padding** on the bottom controls container — replace `pb-[env(safe-area-inset-bottom,16px)] px-6 pb-6` with proper single padding declaration

2. **Replace absolute-positioned overlay divs** with a simpler SVG or CSS approach — use a single overlay with `pointer-events-none` and let the viewfinder be the visual guide without complex calc-based overlays that drift on different screen sizes

3. **Constrain the layout with proper spacing** — use `min-h-0` on the flex-1 area and ensure the bottom section doesn't overlap by using `shrink-0`

4. **Reduce viewfinder size on very small screens** — use responsive sizing (240px instead of 260px) and adjust overlay calculations to match

5. **Reduce bottom control gaps** — tighten `gap-8` to `gap-5` and `mb-8` to `mb-4` for better fit on 605px height screens


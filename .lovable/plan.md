

## Fix: Background Textures Not Showing on Light Theme

### Root Cause

The `::before` pseudo-element has `z-index: 0`, which places it **behind** the app's content containers. In light mode, the page background (typically solid white from `--background`) on the main content `div` completely covers the pattern. In dark mode, the higher opacity (0.25) plus darker/semi-transparent backgrounds make it slightly more visible, but the core problem is the same: the pattern sits behind opaque content backgrounds.

### Fix

**File: `src/index.css`**

1. Change `z-index` from `0` to `1` on the `::before` element so it renders **above** the page background but still below interactive content (which is `z-index: auto` or higher in stacking contexts)
2. Increase light-mode opacity from `0.18` to `0.22` for better visibility on white backgrounds
3. The SVG patterns using gold (#d4af37) on white backgrounds need higher internal opacity -- boost fill opacities across all patterns (from ~0.2 range to ~0.4 range) so the textures are clearly visible against light backgrounds

These changes ensure the pattern layer renders above the solid background color but below all interactive UI, making textures visible in both light and dark modes.


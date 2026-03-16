

## Fix Background Textures & Add Fireworks on Every Login

### Problems Identified

1. **Background patterns barely visible**: The base `::before` opacity is set to `0.06` (light) / `0.08` (dark) -- far too subtle to see. The SVG patterns themselves also have very low internal opacity values (0.1-0.25), compounding the invisibility.

2. **Burst effect only fires once per session**: `FestivalBodyEffect` uses `sessionStorage` to ensure it only plays once. User wants a fireworks celebration **every time they open the app** while a theme is active, not just once.

### Plan

**File: `src/index.css`** -- Fix pattern visibility
- Increase base `::before` opacity from `0.06`/`0.08` to `0.12`/`0.18` so patterns are actually visible
- Boost internal SVG fill/stroke opacity values across all 14 patterns (roughly double each)
- Add a subtle CSS animation (`festival-pattern-shimmer`) that slowly shifts background position, giving patterns a living, premium feel

**File: `src/components/FestivalBodyEffect.tsx`** -- Fireworks on every login
- Remove the `sessionStorage` guard so the burst plays every time the component mounts (every page load / login)
- Add `fireworks` characters to all theme burst mappings as secondary particles -- so every festival gets a fireworks feel alongside its themed particles (e.g., Ramadan gets crescents + fireworks sparkles)
- Increase particle count from 30 to 45 for a more dramatic entrance
- Add multi-wave bursts: first wave at 0s, second wave at 0.8s for a more realistic fireworks effect

**File: `src/components/admin/AdminFestivalThemes.tsx`** -- No changes needed (presets already mapped correctly)

### Summary of Changes

| File | Change |
|------|--------|
| `src/index.css` | Boost pattern opacity, add shimmer animation |
| `src/components/FestivalBodyEffect.tsx` | Remove session-once guard, add fireworks to all themes, increase particles, add second burst wave |


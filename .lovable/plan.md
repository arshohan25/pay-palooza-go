

## Live Preview Panel for Festival Theme Editor

### Current State
The Preview tab already exists (lines 621-687) but only shows a basic banner + a flat palette swatch. It lacks a realistic app mockup.

### Plan

**Replace the existing Preview tab content** in `AdminFestivalThemes.tsx` with a rich, interactive live preview panel that renders a miniature phone mockup showing how the full app would look with the current palette applied. The preview updates in real-time as the admin edits palette values.

### Preview Mockup Content

A 320px-wide phone frame containing:

1. **Status bar** -- time, battery icons using foreground color
2. **Header** -- app name, notification bell, using primary + background
3. **Balance card** -- hero gradient with balance amount, glow shadow
4. **Quick action row** -- 4 icon circles using primary/muted colors
5. **Transaction list** -- 2-3 sample rows using card/card-foreground/muted
6. **Bottom nav** -- 4 tabs with active state using primary
7. **Greeting banner overlay** -- the festival banner with emoji/gradient

All elements styled using inline styles derived from `form.theme_palette`, with sensible fallbacks to current CSS vars.

### Additional Features

- **Light/Dark toggle** within the preview panel -- switches between showing light palette keys vs `dark-*` palette keys
- Preview is always visible alongside the form (side-by-side on wide screens, stacked on narrow)

### Implementation

**File: `src/components/admin/AdminFestivalThemes.tsx`**
- Replace the Preview tab content (lines 621-687) with the phone mockup component
- Add a `previewDark` boolean state for the light/dark toggle
- Helper function `p(key)` that resolves palette value: if `previewDark`, looks up `dark-{key}` first, falls back to `{key}`
- The mockup is a self-contained inline-styled div, no external dependencies needed

### Files Changed

| File | Action |
|------|--------|
| `src/components/admin/AdminFestivalThemes.tsx` | Edit -- replace Preview tab with phone mockup + dark/light toggle |


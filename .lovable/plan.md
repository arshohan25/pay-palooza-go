

## Premium Visual Background Textures for Festival Themes

### What We're Adding

New high-fidelity SVG background patterns inspired by the reference images, matched to each festival type for a premium feel in both light and dark modes.

### New Body Patterns

| Pattern | Festivals | Inspiration |
|---------|-----------|-------------|
| `arabesque` | Ramadan, Eid Fitr, Eid Adha, Hijri New Year | Golden Islamic geometric star/polygon tessellation (images 5-6) |
| `lanterns` | Ramadan (dark), Eid variants | Hanging lantern silhouettes with warm glow dots (images 8-9) |
| `mosque` | Ramadan, Hijri New Year | Mosque dome/minaret silhouette with soft radial glow (image 7) |
| `waves` | New Year, Victory Day, Independence Day | Flowing particle wave lines with glowing dots (images 1-4) |
| `rangoli` | Durga Puja, Pohela Boishakh | Circular mandala/rangoli geometric pattern |

### Changes

**File: `src/index.css`**
- Add 5 new `festival-body-*` pattern CSS rules with detailed inline SVG backgrounds
- `arabesque`: Interlocking 12-point star geometric pattern in gold (#d4af37) -- elegant Islamic tessellation
- `lanterns`: Hanging ornate lantern shapes with warm glow circles
- `mosque`: Dome and minaret silhouettes with scattered golden dots
- `waves`: Flowing sine-wave particle lines with glowing nodes -- futuristic tech feel
- `rangoli`: Circular mandala patterns with petal geometry
- All patterns use subtle opacity (0.04-0.08 light, 0.06-0.10 dark) for premium understated look

**File: `src/components/admin/AdminFestivalThemes.tsx`**
- Add new patterns to `BODY_PATTERNS` array: `"arabesque"`, `"lanterns"`, `"mosque"`, `"waves"`, `"rangoli"`
- Update preset mappings:
  - Ramadan: `body_pattern: "arabesque"` (golden geometric fits the Islamic aesthetic)
  - Eid Fitr: `body_pattern: "lanterns"` (celebratory lantern feel)
  - Eid Adha: `body_pattern: "mosque"` (sacred architecture)
  - Hijri New Year: `body_pattern: "arabesque"`
  - Pohela Boishakh: `body_pattern: "rangoli"`
  - Durga Puja: `body_pattern: "rangoli"`
  - New Year: `body_pattern: "waves"` (futuristic celebration)
  - Victory Day: `body_pattern: "waves"`
  - Independence Day: `body_pattern: "waves"`

### Design Approach
- All patterns are pure CSS inline SVG (no external images needed)
- Subtle enough to not interfere with content readability
- Higher opacity in dark mode for visibility against dark backgrounds
- Premium, understated aesthetic -- not cartoonish


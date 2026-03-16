

## Full-App Festival Theming System

### Problem
The current festival system only renders a small banner overlay. The user wants activating a festival theme to **transform the entire app** — colors, gradients, card backgrounds, button tints, shadows, bottom nav, balance card, everything.

### Approach: CSS Custom Property Override via React Context

The app already uses CSS custom properties (`--primary`, `--background`, `--gradient-hero`, `--shadow-glow`, etc.) for ALL visual styling. This means we can override them at runtime on `document.documentElement.style` and the **entire app instantly re-themes** without touching any component code.

### Architecture

```text
┌─────────────────────────────────────────────────┐
│  App.tsx                                         │
│   └─ <FestivalThemeProvider>  ← NEW context      │
│       ├─ Fetches active theme from DB            │
│       ├─ Sets CSS vars on :root (runtime)        │
│       ├─ Injects body background pattern/texture │
│       └─ Provides { theme, particles } to tree   │
│           └─ <FestivalOverlay /> reads context    │
│              (banner + particles stay)            │
└─────────────────────────────────────────────────┘
```

### Database Changes

Add a `theme_palette` JSONB column to `festival_themes` to store a full color map:

```sql
ALTER TABLE festival_themes ADD COLUMN theme_palette jsonb DEFAULT '{}';
```

The JSONB stores HSL overrides for every CSS variable:
```json
{
  "primary": "270 60% 55%",
  "background": "245 30% 12%",
  "card": "250 25% 16%",
  "foreground": "240 20% 92%",
  "muted": "250 20% 20%",
  "border": "250 18% 22%",
  "ring": "270 60% 55%",
  "gradient_hero": "linear-gradient(150deg, hsl(270 60% 30%) 0%, hsl(250 50% 20%) 60%, hsl(230 45% 15%) 100%)",
  "gradient_primary": "linear-gradient(135deg, hsl(270 60% 45%), hsl(250 50% 35%))",
  "shadow_glow": "0 0 0 1px hsl(270 60% 55% / 0.1), 0 4px 24px -4px hsl(270 60% 55% / 0.3)",
  "body_pattern": "crescents"
}
```

### Festival Presets — Full Palettes

Each preset defines a complete color system:

| Festival | Primary | Background | Hero Gradient | Effect |
|----------|---------|------------|---------------|--------|
| Ramadan | Deep purple `270 60% 55%` | Dark indigo `245 30% 12%` | Indigo → purple → midnight | Crescents + stars |
| Eid Fitr | Emerald gold `160 60% 45%` | Dark teal `170 30% 10%` | Teal → emerald → gold | Stars + sparkles |
| Eid Adha | Warm amber `35 70% 50%` | Dark brown `30 25% 10%` | Brown → amber → sand | Stars |
| Pohela Boishakh | Vermillion `0 70% 50%` | Warm cream `35 40% 94%` (light!) | Red → orange → gold | Petals |
| New Year | Royal blue `230 80% 50%` | Midnight `225 40% 8%` | Navy → blue → purple | Fireworks |
| Christmas | Holly red `0 70% 45%` | Forest `150 30% 10%` | Red → green → dark | Snow |
| Victory Day | Bangladesh green `150 80% 35%` | Deep green `155 35% 8%` | Green → red | Confetti |
| Durga Puja | Magenta `330 60% 50%` | Deep wine `340 30% 12%` | Pink → gold | Leaves |

### New Files

**`src/contexts/FestivalThemeContext.tsx`** — Provider that:
- Fetches active `festival_themes` row on mount
- Maps `theme_palette` JSON keys to CSS variable overrides on `:root`
- Injects a subtle full-page background texture/pattern via a `::before` pseudo-element class on `body`
- Cleans up CSS vars when theme deactivates
- Exposes `{ festivalTheme, isActive }` via context

**`src/components/FestivalBodyEffect.tsx`** — Renders full-screen particles (fixed position, pointer-events none) that float across the entire app, not just the banner. Controlled by context.

### Modified Files

**`src/App.tsx`** — Wrap with `<FestivalThemeProvider>` inside ThemeProvider

**`src/components/FestivalOverlay.tsx`** — Simplify to read from context instead of fetching independently. Keep the dismissible greeting banner.

**`src/components/admin/AdminFestivalThemes.tsx`** — Add palette editor section:
- Color pickers/HSL inputs for: primary, background, card, foreground, muted, border
- Gradient editor for hero gradient
- Body pattern selector (subtle geometric patterns)
- "Preview entire palette" button
- Auto-generated palette from preset selection

**`src/index.css`** — Add body pattern classes (`.festival-body-crescents`, `.festival-body-snowflakes`, etc.) using CSS pseudo-elements with repeating SVG backgrounds

### How It Works End-to-End

1. Admin selects "Ramadan" preset → form auto-fills palette with deep purples/indigos
2. Admin activates the theme
3. `FestivalThemeProvider` fetches the active theme, sets CSS variables:
   - `--primary: 270 60% 55%` (purple replaces green)
   - `--background: 245 30% 12%` (dark indigo)
   - `--gradient-hero: linear-gradient(...)` (purple hero card)
   - `--shadow-glow: ...` (purple glow)
4. **Every component** using `hsl(var(--primary))`, `gradient-hero`, etc. instantly reflects the new palette
5. Full-screen crescent particles float gently across all pages
6. Greeting banner shows at top of home screen

### What Changes Visually for Users

- Balance card gradient transforms to festival colors
- All buttons, badges, active states change to festival primary
- Background color shifts to match festival mood
- Bottom nav active indicator uses festival accent
- Card borders and shadows adopt festival tint
- Subtle floating particles across entire app (not just banner)
- Quick action icon active states tint to festival colors
- Scrollbar thumb color changes
- Selection highlight color changes

### Migration

```sql
ALTER TABLE public.festival_themes ADD COLUMN IF NOT EXISTS theme_palette jsonb DEFAULT '{}';
ALTER TABLE public.festival_themes ADD COLUMN IF NOT EXISTS body_pattern text DEFAULT 'none';
```


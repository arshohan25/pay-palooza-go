

## Festival Theme Manager for Admin Panel

### What We're Building

A new admin module **"Festival Themes"** that lets admins activate seasonal/festival themes which apply visual overlays, greeting banners, and color accents to the user-facing app. Admins can schedule themes in advance and only one theme is active at a time.

### Supported Festivals (Presets)

Ramadan Mubarak, Eid Ul Fitr, Eid Ul Adha, New Year (Jan 1), Pohela Boishakh (Bangla New Year), Arabic/Hijri New Year, Victory Day (Dec 16), Independence Day (Mar 26), Durga Puja, Christmas, and a "Custom" option for ad-hoc themes.

### Database

New table `festival_themes`:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | e.g. "Ramadan Mubarak" |
| preset_key | text | e.g. `ramadan`, `eid_fitr`, `custom` |
| greeting_text | text | Banner message shown to users |
| accent_color | text | HSL or hex override for primary accent |
| emoji | text | e.g. 🌙 ☪️ 🎆 |
| overlay_effect | text | `stars`, `lanterns`, `confetti`, `snow`, `fireworks`, `none` |
| banner_gradient | text | CSS gradient string for greeting card |
| is_active | boolean | Only one should be active |
| starts_at | timestamptz | Schedule start |
| ends_at | timestamptz | Schedule end |
| created_by | uuid | |
| created_at / updated_at | timestamptz | |

RLS: Admin-only for ALL, authenticated SELECT for active themes.

### Admin Component: `AdminFestivalThemes.tsx`

- List of all themes with status badges (Active / Scheduled / Inactive)
- Create/Edit form with preset selector that auto-fills emoji, accent color, overlay, and gradient
- Toggle active state (deactivates others automatically)
- Schedule with start/end dates
- Live preview card showing how the greeting banner will look

### User-Facing Component: `FestivalOverlay.tsx`

- Fetches the currently active theme from the database
- Renders a **greeting banner** at the top of the home screen (below PlatformBanner) with the festival gradient, emoji, and greeting text
- Applies a subtle **particle overlay** (CSS animations) based on `overlay_effect`:
  - `stars` — twinkling dots
  - `lanterns` — floating amber circles
  - `confetti` — colored falling pieces
  - `snow` — white falling dots
  - `fireworks` — burst animations
- All effects are lightweight CSS-only (no heavy libraries)
- Dismissible per session

### Admin Navigation

Add `{ id: "festival_themes", label: "Festivals", icon: Star }` to the **Marketing** group in `NAV_GROUPS`.

### Files

| File | Action |
|------|--------|
| Migration SQL | **Create** — `festival_themes` table + RLS |
| `src/components/admin/AdminFestivalThemes.tsx` | **Create** — full CRUD admin UI with presets |
| `src/components/FestivalOverlay.tsx` | **Create** — user-facing banner + particle effects |
| `src/pages/AdminDashboard.tsx` | **Edit** — add nav item + import + render |
| `src/pages/Index.tsx` | **Edit** — add `<FestivalOverlay />` to home screen |


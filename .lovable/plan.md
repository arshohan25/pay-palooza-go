

## Add New Particle Effects to Festival Themes

### New Effects to Add

| Effect | Visual | Used For |
|--------|--------|----------|
| `petals` | Falling/floating rose petals (pink/red tear-drop shapes) | Pohela Boishakh |
| `crescents` | Floating crescent moon shapes (gold/silver) | Ramadan, Eid |
| `hearts` | Falling heart shapes | Valentine's / love themes |
| `leaves` | Falling autumn leaves (orange/brown) | Seasonal / Durga Puja |
| `sparkles` | Twinkling diamond sparkles | General celebrations |

### Changes

**`src/components/FestivalOverlay.tsx`**
- Add 5 new entries to `PARTICLE_STYLES` map
- Add CSS `@keyframes` for each: `petal-fall` (swaying descent), `crescent-float` (gentle rise + glow), `heart-fall`, `leaf-fall` (rotation + sway), `sparkle` (scale pulse + fade)
- Style each particle shape via CSS (e.g., petals use `border-radius: 80% 0 55% 50% / 55% 0 80% 50%`, crescents use `box-shadow` to create moon shape)

**`src/components/admin/AdminFestivalThemes.tsx`**
- Add new effects to `EFFECTS` array: `"petals"`, `"crescents"`, `"hearts"`, `"leaves"`, `"sparkles"`
- Update `pohela_boishakh` preset to use `petals` effect
- Update `ramadan` preset to use `crescents` effect
- Update `durga_puja` preset to use `leaves` effect

### Files Changed

| File | Action |
|------|--------|
| `src/components/FestivalOverlay.tsx` | Edit — add 5 new particle styles + CSS animations |
| `src/components/admin/AdminFestivalThemes.tsx` | Edit — add effects to dropdown + update presets |


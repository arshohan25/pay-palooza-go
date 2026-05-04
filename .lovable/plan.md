# Premium Backdrop for Chat Drawer

The current dark backdrop reads as flat black with a faint purple tint, which makes the gutters around the white drawer look like dead space rather than an intentional frame. Make it feel premium.

## What changes

### `src/pages/MerchantSupportPage.tsx` — replace the page background

Swap the flat radial gradient + single primary glow for a layered aurora composition behind the drawer:

1. **Base gradient** (replaces current `bg-[radial-gradient(...)]`):
   ```text
   radial-gradient(120% 80% at 50% -10%,
     #6d4ea8 0%, #3b2563 28%, #1f1638 60%, #15102b 100%)
   ```
   Warm violet at the top blending into deep indigo at the bottom — feels lit, not black.

2. **Three soft color blooms** (absolutely positioned, blurred, behind the drawer):
   - Top-center primary halo (`hsl(var(--primary)/0.45)`, large radial, blur-3xl)
   - Mid-left fuchsia bloom (`bg-fuchsia-500/15`, h-72 w-72, blur-3xl)
   - Bottom-right cyan bloom (`bg-cyan-400/10`, h-72 w-72, blur-3xl)
   These create the iOS-control-center / Apple Vision aesthetic.

3. **Subtle film grain** via inline SVG fractal-noise data URL at `opacity-[0.05] mix-blend-overlay` — kills banding and adds a tactile "physical" feel premium designs use.

4. Add `overflow-hidden` to the root so the blooms can't trigger scrollbars.

### Header polish (same file)

- Header background goes from `bg-white/[0.03]` to `bg-white/[0.06]` with `border-white/15` to read more clearly against the brighter backdrop.
- Back button gets a `ring-1 ring-white/15` for definition.

### Drawer panel ring (same file)

- Strengthen the white drawer's outline to `ring-1 ring-white/20` and add a soft top highlight (`shadow-[0_-22px_60px_-22px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.7)]`) so the panel reads as a discrete card floating over the aurora rather than a sheet glued to the bottom.

## Technical notes

- No backend or schema work; pure CSS/JSX in `src/pages/MerchantSupportPage.tsx`.
- No new dependencies. Grain is a tiny inline SVG (~150 bytes), no network call.
- Uses semantic `--primary` token for the main bloom; the fuchsia/cyan accents are intentional secondary hues that complement the violet base — these are decorative atmospherics, not brand colors.
- Verification: viewport 390×844 — the gutters around the white drawer should now show a soft violet→indigo gradient with two faint colored blooms, not flat black.

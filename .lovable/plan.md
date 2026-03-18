

## Unique Amount Page Redesign

The amount step (lines 251-372) currently has a clean layout but lacks visual distinction. Here's the plan to give it a truly unique, standout look:

### Changes — `src/pages/DonationsPage.tsx` (amount step only)

**1. Radial Glow Background**
- Add a large, blurred radial gradient circle behind the amount display using the selected cause's gradient colors (absolute positioned, `w-48 h-48 blur-3xl opacity-20`). Creates a subtle "aura" effect unique to each cause.

**2. Circular Amount Display**
- Replace the flat amount text with a large circular ring container (`w-52 h-52 rounded-full`) with a thin gradient border (using the cause gradient). The amount sits centered inside with the currency symbol above. Gives a "coin" or "target" feel — visually distinctive and memorable.

**3. Animated Ring Progress**
- Add an SVG ring around the circle that fills based on amount relative to max (e.g., 10000). Uses `stroke-dashoffset` animated with framer-motion. Purely decorative but adds life.

**4. Preset Amount Chips — Glass Morphism**
- Replace flat pills with glass-style chips: `bg-white/10 backdrop-blur-md border border-white/20` in dark mode, `bg-black/5 backdrop-blur-md` in light mode. Selected state fills with the cause gradient. Layout as a horizontal scroll strip with snap behavior.

**5. Toggles — Card Style**
- Wrap anonymous and recurring toggles in individual rounded-2xl cards with subtle gradient left-accent bars (2px wide, using cause color). Feels more structured and premium versus plain rows.

**6. CTA — Floating Bottom**
- Make the continue button sticky at the bottom with a frosted glass background strip (`backdrop-blur-lg bg-background/80`), so it's always visible. Button itself gets a subtle "shine" gradient overlay (a diagonal white-to-transparent stripe animating on hover).

### Files
- `src/pages/DonationsPage.tsx` — amount step visual overhaul only, no logic changes


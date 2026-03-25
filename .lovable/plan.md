

## Redesign: Premium Balance Card

### Design Direction (inspired by the reference screenshot)
Elevate the card with richer depth, layered glass-morphism backgrounds, organic bokeh-style decorative blurs, and better spatial hierarchy. The reference shows a deep emerald card with soft luminous blobs, frosted-glass action buttons, and generous vertical breathing room.

### Changes in `src/components/BalanceCard.tsx`

**1. Background & Depth**
- Keep `gradient-hero` base but add multiple layered decorative blobs using `bg-emerald-400/15` and `bg-teal-300/10` with large `blur-3xl` for organic bokeh effect (replacing the current hard-edge circles)
- Add a subtle inner border glow via `ring-1 ring-white/10`
- Increase card corner radius and padding for a more spacious feel

**2. Greeting Row**
- Add a wave emoji after "WELCOME BACK" label (matching reference)
- Increase name font size slightly with better weight contrast
- QR and Copy buttons: larger (w-10 h-10), more prominent frosted glass (`bg-white/12 backdrop-blur-xl border border-white/15 rounded-2xl`) with subtle shadow

**3. Balance Section**
- More vertical spacing above/below
- "AVAILABLE BALANCE" label with slightly larger tracking
- "Tap to see balance" pill: refined with `backdrop-blur-xl border border-white/20` and a subtle inner shadow
- When revealed: larger balance text (`text-[2.4rem]`) with a subtle text-shadow for depth
- Add Money button: larger frosted glass card (`bg-white/12 backdrop-blur-xl border border-white/15 rounded-2xl`) with icon + label, more padding

**4. Bottom Section**
- Wallet ID: slightly larger mono text with better letter-spacing
- Share button: frosted glass with border, matching the elevated button style from reference
- Thinner, more subtle divider (`bg-white/8`)

**5. Animations**
- Keep existing motion animations (entry, tap, balance reveal)
- Add subtle `hover:bg-white/18` transitions on all interactive elements

All logic (balance fetching, realtime, QR, share, copy, auto-hide timer) remains completely unchanged. Only visual class changes and minor structural adjustments for spacing.

### File: `src/components/BalanceCard.tsx`
Single file edit -- purely presentational changes to className values and decorative elements.


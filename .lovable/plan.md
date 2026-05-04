## Premium glassmorphism composer redesign

Refines the composer in `src/components/merchant/PinResetTicketChat.tsx`. No backend or layout changes.

### Visual changes

**Composer container**
- Replace the flat `border-t bg-background/95` strip with a layered glass surface: frosted top fade so messages dissolve into it + `bg-gradient-to-b from-background/65 via-background/85 to-background/95 backdrop-blur-2xl` body with a hairline white/10 top border.

**Pill input (glassmorphism)**
- Outer wrapper: `rounded-[24px]` with a 1px gradient ring border (`from-primary/55 via-primary/25 to-primary/45` when typing, neutral border-tone when empty). Animated soft shadow that intensifies with primary glow as the user types (framer-motion on `boxShadow`).
- Inner glass body: `bg-gradient-to-br from-background/60 via-card/55 to-background/75 backdrop-blur-xl` with a top white/30 highlight sheen line for depth.
- Textarea: borderless, transparent, auto-grows up to 120px, `pr-14` to leave room for the counter, placeholder fades to `text-muted-foreground/60`.

**Gradient send button**
- Round 48px button, `bg-gradient-to-br from-primary via-primary to-primary/65` with a heavy primary-tinted shadow + inset highlight.
- A diagonal white sheen sweeps across on hover (transform-translate transition).
- Framer-motion `whileTap` scale 0.92 / `whileHover` scale 1.04 with spring easing.

**Character counter**
- Hidden at 0 chars.
- 1–1500: tiny `9.5px` muted `123/2000` text bottom-right of the input.
- 1500+: morphs into a small SVG progress ring (16px) showing remaining-chars in the center; ring fills primary, switches to `--destructive` in the last 50 chars.

**Resolved state**
- Same emerald confirmation card, upgraded to a soft gradient (`from-emerald-500/[0.08] to-emerald-500/[0.02]`) with backdrop blur to match the new glass language.

### Files touched
- `src/components/merchant/PinResetTicketChat.tsx` — only the `{/* Composer */}` block at the bottom + a tiny `CounterRing` helper component appended to the file. Header, message list, bubbles, skeletons, and all logic stay exactly as-is.

No new dependencies. All colors via existing semantic tokens (`--primary`, `--background`, `--card`, `--muted`, `--border`, `--destructive`).
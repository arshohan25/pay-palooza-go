# Premium Backdrop + Bottom Shutter for Support Chat

Two changes to `src/pages/MerchantSupportPage.tsx` (no schema, no new deps):

## 1. Replace flat black with a layered premium backdrop

Swap the current `bg-[radial-gradient(ellipse_at_top,#2a1a3a...)]` for a richer aurora composition that matches the drawer's primary glow:

- **Base gradient**: `radial-gradient(120% 80% at 50% -10%, #6d4ea8 0%, #3b2563 28%, #1f1638 60%, #15102b 100%)` — warm violet at top blending into deep indigo.
- **Three blurred color blooms** (absolute, behind drawer, `pointer-events-none`):
  - Top-center primary halo: `hsl(var(--primary)/0.45)`, `h-80 w-[140%]`, `blur-3xl`
  - Mid-left fuchsia bloom: `bg-fuchsia-500/15`, `h-72 w-72`, `blur-3xl`
  - Bottom-right cyan bloom: `bg-cyan-400/10`, `h-72 w-72`, `blur-3xl`
- **Film-grain overlay** via inline SVG fractal noise data URL at `opacity-[0.05] mix-blend-overlay` to kill banding and add a "physical" feel.
- **Frosted ring behind drawer**: an absolutely positioned blurred element (`backdrop-blur-2xl bg-white/5`) extending slightly beyond the drawer's top so the gutters feel intentional.
- Add `overflow-hidden` to root so blooms don't trigger scrollbars.
- Strengthen drawer ring to `ring-1 ring-white/20` with inset top highlight `inset_0_1px_0_rgba(255,255,255,0.7)`.

## 2. Bottom shutter system (open / close the drawer)

Make the chat panel itself a controllable bottom sheet that the user can collapse to a peek and re-expand — without leaving the page.

State: `const [shutterOpen, setShutterOpen] = useState(true)` (default open).

Three drawer states driven by Framer Motion `animate` on the panel:
- **Open** (default): `y: 0` — full height as today.
- **Closed/peek**: `y: calc(100% - 64px)` — only a 64px header strip (grab handle + title + unread count) remains visible at the bottom.

Interactions:
- **Grab handle** at the top of the drawer (a 36×4 rounded `bg-white/40` pill inside a 24px tap zone) — tap toggles `shutterOpen`. Already-existing rounded-top corners stay.
- **Drag-to-dismiss**: wrap the panel in `motion.div` with `drag="y"`, `dragConstraints={{ top: 0, bottom: 0 }}`, `dragElastic={0.15}`. On `onDragEnd`, if `offset.y > 120` or `velocity.y > 500` → close; else snap back. If currently closed and `offset.y < -120` → open.
- **Backdrop tap**: clicking the dark backdrop area above the closed peek strip re-opens the drawer (or closes it when open and tapped above panel — only when `shutterOpen` is true and tap is outside panel).
- **Close button** (small `ChevronDown` icon top-right of header inside the drawer) for explicit collapse; replaced by `ChevronUp` when collapsed.

Peek strip content (visible when closed):
```
[ ═══ ]   PIN reset chat       2 new
```
- Grab pill, title "PIN reset · Live support", and a small unread badge (reuses the unread count already tracked by `PinResetTicketChat` via a new `onUnreadChange?: (n: number) => void` callback prop — optional; if not wired, just show the title).

Animation: `transition={{ type: "spring", stiffness: 380, damping: 36 }}` (matches `springTransition` in `src/lib/transitions.ts`).

Keyboard: `Escape` toggles shutter closed when open.

## Technical notes

- Files touched: `src/pages/MerchantSupportPage.tsx` only (and one optional prop addition on `PinResetTicketChat` for unread count — non-breaking, default no-op).
- Uses existing `framer-motion` (already imported elsewhere) and `lucide-react` (`ChevronDown`, `ChevronUp`).
- No backend, no schema, no new dependencies.
- Verify at 390×638: closed state shows ~64px peek at bottom with grab handle; open state restores current full drawer; backdrop visibly violet/indigo with soft color blooms — no flat black.

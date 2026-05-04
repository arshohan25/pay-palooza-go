# Premium Chat Drawer Redesign

Three things to fix from the screenshot:

1. The white chat panel touches the left/right edges of the screen — needs visible "floating" gutters with a soft blur on the dark backdrop.
2. A stray small icon appears just to the right of outgoing bubbles (the leftover read-receipt + spacing combo reads visually like an avatar). The outgoing row needs to end cleanly at the bubble edge.
3. Read receipts exist but are too quiet — they need a clearer "Sent / Delivered / Seen at HH:MM" treatment so you can actually track when support has read each message.

## What changes

### 1. Floating drawer with blurred outer gutters — `src/pages/MerchantSupportPage.tsx`

- Add responsive horizontal padding to the page-level `fixed inset-0` container so the white drawer no longer touches the edges:
  - Mobile (`<sm`): `12px` left/right (combined with safe-area insets via `max(env(safe-area-inset-*), 12px)`)
  - `sm`: `20px`
  - `md`+: keep the existing `max-w-3xl` centering — no extra gutter needed since there's already empty space.
- Strengthen the dark backdrop so the gutter feels intentional: add a subtle radial glow + a frosted blur ring directly behind the drawer (`bg-[radial-gradient(...)]` + an absolutely-positioned blurred element behind the panel).
- Soften the drawer's top corners (already `rounded-t-3xl`) and add a thin highlight border `ring-1 ring-white/10` so the panel reads as a discrete card.
- Header keeps its current safe-area padding — those still work because they live inside the now-padded parent.

### 2. Polished message rows — `src/components/merchant/PinResetTicketChat.tsx`

- Outgoing (`isMe`) rows: drop the `gap-2` on `flex-row-reverse` and tighten to `gap-0` plus a small right margin on the bubble. This guarantees nothing renders to the right of the bubble — eliminating the phantom-icon look in the screenshot.
- Bubble tail refinements:
  - Outgoing: keep gradient `from-primary to-primary/85`, increase shadow softness (`shadow-[0_6px_18px_-8px_hsl(var(--primary)/0.5)]`), bump max width to `82%`.
  - Incoming: switch background to `bg-white/85 dark:bg-card/80` with a hairline `border-border/30` and a subtle inner top highlight for depth.
- Day divider: replace the muted pill with a thin hairline + centered uppercase label ("TODAY") flanked by two `1px` lines — feels more like iMessage/Linear.
- First-of-run avatar (incoming side) gets a soft halo ring instead of the current solid ring.

### 3. Premium read-receipt UI — same file

Per-message footer (right-aligned for outgoing) becomes a single compact pill:

```text
12:21 PM  ✓        →  sending / sent, not yet seen   (grey check)
12:21 PM  ✓✓       →  delivered, seen by admin       (cyan double check)
12:21 PM  Seen 12:24 ✓✓   →  last own message only, with admin's read time inline
```

Concretely:
- Sending (optimistic / temp- id): tiny spinner + "Sending…" in `primary-foreground/65`.
- Sent but `read_by_admin = false`: time + single `Check` icon in `primary-foreground/60`.
- Read (`read_by_admin = true`): time + double `CheckCheck` in soft cyan (`text-cyan-200`).
- Last outgoing message AND read: append a subtle inline "Seen HH:MM" using `read_by_admin_at` — replaces the current separate "Seen by support" row beneath the bubble (cleaner, less vertical noise).
- Add a typed `tooltip` on hover/long-press over the receipt showing the full date + time ("Seen on May 4 at 12:24 PM") — small affordance for power users.

Inbound bubbles continue to show only `HH:MM` in muted text.

### 4. Composer polish (small)

- Tighten attach-button + send-button height from `h-12` to `h-11` to match the slimmer composer feel.
- Composer top-edge gradient stays; add a `shadow-[0_-12px_24px_-20px_rgba(0,0,0,0.3)]` to lift the composer above the message list when scrolled.

## Technical notes

- No backend or schema changes. All read-receipt data (`read_by_admin`, `read_by_admin_at`) is already populated by the edge function; we're only redesigning how the UI surfaces it.
- No new dependencies; uses existing `framer-motion` + `lucide-react` icons (`Check`, `CheckCheck`, `Loader2`).
- Files touched: `src/pages/MerchantSupportPage.tsx`, `src/components/merchant/PinResetTicketChat.tsx`.
- Verification: navigate to `/merchant-support?ticket=…` at viewport 390×844 and confirm visible gutters on both sides + clear "Seen 12:24" inline on the last sent message.

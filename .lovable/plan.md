

## Plan: Clean Modern Redesign of Send Money Flow

Simplify the current over-styled flow into a clean, minimal, eye-catching design with bold typography, generous whitespace, and fewer visual layers.

### Design Direction
- Remove heavy glassmorphism and excessive shadows — use flat clean cards with subtle borders
- Bigger, bolder typography for key information
- Clean white/transparent backgrounds with accent color pops
- Simpler header — no radial glow blobs, cleaner stepper
- More whitespace, less visual noise
- Smooth but minimal animations

### Changes — `src/components/SendMoneyFlow.tsx`

**1. Header**
- Remove decorative radial glow divs (the 2 blur circles)
- Simplify stepper: clean pill-shaped active indicator instead of glowing dots
- Tighter, cleaner layout

**2. Step 1 — Recipient**
- Remove the outer card wrapper around search — just the input directly on background
- Cleaner search input: taller, minimal, with subtle bg
- QR button: simple icon-only circle instead of gradient pill with text
- Recent contacts: keep horizontal scroll but use clean circular avatars (not rounded-2xl squares)
- Remove uppercase tracking-wider labels — use normal-case subtle labels

**3. Step 2 — Amount**
- Recipient pill: simpler, smaller chip
- Amount input: much larger font (text-5xl), fully centered with currency above
- Quick amounts: simple rounded-full pills, clean selected state (solid primary, no glow)
- Note: keep underline style but cleaner
- Cash-out toggle: simpler row, less padding
- Fee breakdown: simple list with no card wrapper, just clean rows
- Remove excessive shadow classes (shadow-glow-lg, shadow-elevated)

**4. Step 3 — Confirm**
- Hero amount: clean and bold
- Recipient + summary: single clean card, no left accent bar (simpler)
- Remove security badge (visual noise)
- Buttons: clean solid + ghost

**5. Step 4 — PIN**
- Keep compact header
- Clean PIN dots (no glow effect)
- SlideToConfirm unchanged

**6. Step 5 — Success**
- Simpler success icon: clean circle with check, remove pulsing ring animation
- Clean receipt card without left accent bar
- Clean buttons

**7. General**
- Replace `rounded-3xl` with `rounded-2xl` throughout (less exaggerated)
- Replace `shadow-elevated`, `shadow-glow`, `shadow-glow-lg` with `shadow-sm` or none
- Remove `staggerContainer`/`staggerChild` — use simple fade-in for cleaner feel
- Keep slide transitions between steps

### Files Modified
- `src/components/SendMoneyFlow.tsx`


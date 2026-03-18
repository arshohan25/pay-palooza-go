

## Redesign Donation Flow — Simple, Elegant, Premium

### Current State
The page works but feels utilitarian: dense card borders, small text, generic layout. No visual hierarchy or premium feel.

### Design Direction
Clean, spacious, premium mobile-first design with soft gradients, large typography, subtle shadows, and fluid animations. Inspired by Apple Pay / Venmo donation flows.

### Changes (single file: `src/pages/DonationsPage.tsx`)

**Header**: Frosted glass header with a subtle gradient accent line beneath. Larger, bolder title.

**Step 1 — Cause Selection**:
- Hero section with large heading "Make a Difference" and subtitle
- 2-column grid with larger cards: big gradient icon circle, cause name below, soft shadow on hover with a gentle scale effect
- Remove border-heavy look, use `shadow-md` + `bg-gradient-to-br` subtle backgrounds

**Step 2 — Amount**:
- Selected cause shown as a premium banner card with full-width gradient background and white text
- Large centered amount display (like a calculator display) instead of inline input
- Preset amount chips as pill buttons with rounded-full shape
- Custom amount input styled as a large, minimal underline-style field
- Message textarea with floating label feel
- Toggles (anonymous, recurring) as elegant pill-shaped rows with soft background
- "Continue" button as a full-width gradient button with the amount embedded

**Step 3 — PIN**:
- Centered layout with cause icon at top in a large soft gradient circle
- Summary: cause + amount in large elegant type
- PIN dots instead of plain password input (4 separate rounded squares)
- Gradient "Confirm" button matching the cause color

**Step 4 — Success**:
- Large animated checkmark in a gradient circle with confetti
- "Thank You" in large serif-like bold text
- Amount and cause in muted elegant layout
- Recurring badge if applicable
- Action buttons as rounded-full pills with icons: "Donate Again" (primary gradient), "Home" (outline), "Share" (outline)

**Tabs Redesign**:
- Pill-style tab triggers with icons, no visible list background
- History/Recurring/Leaderboard cards: remove harsh borders, use subtle shadows and rounded-2xl
- Leaderboard: top-3 entries get subtle gold/silver/bronze left-accent borders

**Animation Polish**:
- Staggered card entrances
- Smooth step transitions with spring physics
- Success checkmark: scale spring + confetti burst (using existing `fireSuccessConfetti`)

### Files to Change
- `src/pages/DonationsPage.tsx` — full UI overhaul, same logic/state unchanged


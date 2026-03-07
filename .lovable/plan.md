## Plan: Premium Redesign of Send Money Flow

### Overview

Complete visual and UX overhaul of all 5 steps in SendMoneyFlow — modern glassmorphism cards, refined typography hierarchy, smooth micro-interactions, and polished layout. All existing logic (fees, cash-out charge, PIN, limits, QR, real contacts) stays intact.

### Changes — `src/components/SendMoneyFlow.tsx` (full rewrite of JSX/styling, logic untouched)

**1. Header Redesign**

- Taller gradient header with subtle radial glow overlay
- Step indicator: replace plain progress bar with labeled dot stepper (4 dots with active/completed states + connecting lines)
- Frosted glass back button with blur backdrop

**2. Step 1 — Recipient**

- Floating search card with soft inner shadow, larger padding, rounded-3xl
- QR scan button styled as a gradient pill instead of plain muted square
- Input type badge gets a subtle animated entrance
- Recent contacts displayed as horizontal scrollable avatar chips (circular avatars with name below) instead of vertical list cards — more modern, saves space
- Empty state: illustrated icon + text
- Continue button: full-width with subtle shadow-glow, rounded-2xl

**3. Step 2 — Amount**

- Recipient shown as a compact pill/chip at top (avatar + name + phone in one line)
- Large centered amount input with oversized currency symbol, no border — just a bottom accent line that glows on focus
- Quick amount chips: horizontal scroll row with pill shape, selected state has gradient + scale animation
- Note input: minimal underline style
- Cash-out charge toggle: sleek switch with animated icon color transition
- Fee breakdown: glass-card with subtle gradient border, cleaner spacing
- Review button with gradient + shadow-glow-lg

**4. Step 3 — Confirm**

- Hero amount with animated counting effect appearance
- Recipient card with left accent bar (gradient colored)
- Transfer summary in a clean table-like layout with alternating subtle row backgrounds
- Animated shield icon for security trust indicator replacing the plain User icon balance row
- Two buttons: primary gradient "Confirm & Enter PIN" and ghost "Edit"

**5. Step 4 — PIN**

- Centered amount + recipient as compact header
- PIN dots larger with glow effect when filled
- Hidden input remains but styled cleaner
- SlideToConfirm unchanged (already polished)

**6. Step 5 — Success**

- Animated gradient ring behind checkmark (pulsing glow)
- Receipt card with subtle left gradient accent bar
- Confetti already fires — add a subtle particle shimmer overlay via CSS
- Buttons with proper spacing and hover states

**7. General Styling**

- All cards: `rounded-3xl` for premium feel
- Consistent `shadow-card` and `shadow-elevated` usage
- Subtle entrance animations with staggered delays on each step's children
- Remove redundant spacing inconsistencies

### Files Modified

- `src/components/SendMoneyFlow.tsx` — Full JSX/styling rewrite across all 5 steps (~400 lines of template changes, zero logic changes)

N. B. There's should not be exrta or less space, everything should be perfect 
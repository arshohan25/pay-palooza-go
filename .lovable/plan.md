

## Premium Donation Flow Redesign

### Design Philosophy
Shift from "functional app" to "luxury fintech" aesthetic. Think Wise/Revolut charity screens — generous whitespace, subtle depth, micro-interactions, and a refined color palette.

### Changes (single file: `src/pages/DonationsPage.tsx`)

**Header**: Minimal — just back arrow and "Donations" text, no sparkle icon. Clean single-line divider removed; let content breathe.

**Step 1 — Cause Selection**:
- Hero: Soft gradient background blob behind heading area (absolute positioned, blurred)
- Heading: "Choose a Cause" with a subtle animated heart icon
- Cards: 2-column grid, taller cards with rounded-3xl, subtle `ring-1 ring-border/50`, no harsh shadows. On tap: gentle scale + ring highlight. Icon circles slightly larger (w-14 h-14). Add a soft description line under each cause name (e.g., "Support students in need")
- Stagger animation with spring physics

**Step 2 — Amount**:
- Cause banner: Compact pill at top showing icon + cause name (not a full gradient card — cleaner)
- Amount display: Extra-large `text-5xl` with currency symbol in lighter weight, centered with generous vertical padding
- Presets: Rounded-full pills in a row, selected state uses cause gradient (not generic primary)
- Custom input: Replace underline style with a clean rounded-2xl bordered input, center-aligned
- Message: Rounded-2xl with subtle placeholder, collapsible (tap to expand)
- Toggles: Cleaner layout — single-line rows with minimal icons, thinner dividers
- CTA: Full-width rounded-2xl button with cause gradient, subtle shadow-lg, embedded amount

**Step 3 — PIN**:
- Minimal top section: Small cause icon pill + amount
- PIN squares: Rounded-xl with softer border, filled dot uses cause gradient background (not just border change)
- Hidden input focus trick kept
- CTA: Matching gradient, "Confirm ৳X" format

**Step 4 — Success**:
- Large checkmark in a soft gradient circle with a subtle pulsing ring animation behind it
- "Thank You" in text-3xl font-extrabold
- Amount and cause in clean hierarchy
- Badges for anonymous/recurring as subtle outline pills
- Action buttons: Primary "Donate Again" as gradient pill, "Home" and "Share" as ghost outline pills with rounded-full

**Tabs**:
- Slim segmented control look: rounded-xl container with bg-muted, active tab gets bg-background with shadow-sm (like iOS segmented control)
- Smaller text, tighter spacing

**List Items (History/Recurring/Leaderboard)**:
- Cards with `bg-card/80 backdrop-blur-sm`, rounded-2xl, ring-1 ring-border/40 instead of shadow
- Leaderboard top 3: Left gradient accent bar (4px wide, rounded) instead of full border tint
- Medal icons: Use actual emoji medals (🥇🥈🥉) instead of colored trophy icons

**Micro-interactions**:
- Cause cards: `whileHover={{ y: -2 }}` and `whileTap={{ scale: 0.97 }}`
- Amount presets: spring bounce on select
- Success checkmark: `scale: [0, 1.15, 1]` keyframe sequence
- Success ring pulse: CSS keyframe animation behind the check circle

### Files
- `src/pages/DonationsPage.tsx` — full visual overhaul, all logic/state unchanged


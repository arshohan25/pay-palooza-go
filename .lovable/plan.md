## What to change

On the Goals list, each card currently shows a big **+ Deposit** button and a **50d lock** pill at the bottom. Since tapping the card already opens the full plan details sheet (which has deposit, schedule, lock info, pause/cancel, etc.), these inline controls are noisy and duplicate what's one tap away.

## Plan

**1. Goal card (`src/pages/SavingsPage.tsx`, lines ~285–310)**
- Remove the bottom action row entirely: the `+ Deposit` button, the `50d lock` pill, and the inline `Cancel` link.
- Keep the card fully tappable → opens the existing details sheet.
- Add a subtle lock hint in the header instead: a small `Lock` icon (10px, muted) next to the goal name when `totalLock > 0`, with a tooltip/aria-label like "Locked · 50 days left". No pill, no chip — just the icon.
- For completed goals, keep the `Withdraw →` button (it's a terminal state, not redundant with details).

**2. Details sheet**
- Confirm Deposit + Cancel actions live inside the sheet. If missing, add a primary `Deposit` button in the sheet footer and a subtle `Cancel goal` text button (only when `totalLock === 0`). Lock status is already shown in the sheet.

**3. No logic changes**
- `goalLockDaysLeft`, deposit flow, cancel flow all remain intact — only the surface where they appear changes.

## Result

Cleaner, modern card: emoji · name (with tiny lock glyph if locked) · amounts · progress bar · percent. Nothing else. All actions consolidated in the details sheet.

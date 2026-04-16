

# Restructure DPS Page: Active Plans First, Create Button Below

## What Changes
Reorganize the `step === "autosave"` section in `SavingsFlow.tsx` so that:
1. **Active DPS plans are shown first** at the top (the existing plan cards)
2. **A prominent "Open New DPS" button** appears below the active plans list
3. Tapping "Open New DPS" navigates to a **new step** (e.g. `"dps-create"`) which contains the current create form (Sharia badge, frequency, amount, duration, strategy, etc.)

## Current Flow
`autosave` step = Create form on top → Active plans listed below

## New Flow
- `autosave` step = Active DPS plans list → "Open New DPS" button at bottom
- `dps-create` step (new) = The existing create form (moved here)

## Changes (single file: `src/components/SavingsFlow.tsx`)

### 1. Add `"dps-create"` to `SavingsStep` type (line 149)

### 2. Update back navigation (around line 644)
- `dps-create` → goes back to `autosave`
- `autosave` → goes back to `home`

### 3. Restructure `step === "autosave"` section (lines ~1230-1460)
- Keep only the **Active Plans list** (currently at bottom, lines ~1374+)
- Show empty state if no active plans ("No active DPS plans yet")
- Add a premium "Open New DPS" button at the bottom that sets `step` to `"dps-create"`

### 4. Create new `step === "dps-create"` section
- Move the entire create form (Sharia badge, frequency, amount, duration, strategy, link-to-goal, estimated profit, "Continue to Review" button) into this new step
- No changes to form logic — just relocated

### 5. Update `review` step back navigation
- When pressing back from `review`, go to `dps-create` instead of `autosave`

## Result
Users land on a clean list of their active DPS plans with a clear CTA to create new ones — matching a senior-level product layout where the primary view is the portfolio, not the creation form.


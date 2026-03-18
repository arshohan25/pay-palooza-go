

## Single Editable Amount Field

### Problem
The amount step has two separate input areas: a read-only large display (line 262-269) and a separate "Custom amount" input (lines 289-297). User wants one unified editable field.

### Change — `src/pages/DonationsPage.tsx` (lines 262-297)

**Remove**: The static display (lines 262-269) and the separate custom input (lines 289-297).

**Replace with**: A single large editable `<input>` that serves as both the display and the input:
- `text-5xl font-extrabold`, center-aligned, transparent background, no visible border
- Currency symbol `৳` to the left
- `inputMode="numeric"`, filters non-numeric, `autoFocus`
- Subtle bottom border or ring on focus only
- Placeholder "0" when empty

**Keep**: Preset pills below as quick-fill shortcuts (tapping sets the input value).

### Result
One field to view and edit the amount. Presets still work as shortcuts. Cleaner, more intuitive.


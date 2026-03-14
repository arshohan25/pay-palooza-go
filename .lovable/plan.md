

## Fix PIN Screen Layout: Center PIN Field & Move Warning Below

### Problem
The PIN entry area (circles + keypad) is top-aligned instead of vertically centered. The PIN security warning ("Avoid 1234, 1111...") sits in a shared error/status area below the circles but above the keypad, making it feel disconnected. The Install Prompt banner also still appears on this screen.

### Changes

**File: `src/pages/AuthPage.tsx`** (lines 1017-1083, the register_pin / forgot_pin block)

1. Change the wrapper from `space-y-5` to a flex column with `flex-1 justify-center` so the entire PIN block is vertically centered in the available space.

2. Move the PIN weak hint (Shield icon + `pinWeakHint` text, currently at line 1053-1057) to render directly below `PinCircles` — between the dots and the error area — so users see the warning right next to where they're looking.

3. Keep the error/submitting status area but remove the hint from it (it only shows errors or loading state now).

4. The `NumericKeypad` stays at
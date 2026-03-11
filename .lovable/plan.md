

## Fix: System keyboard still appearing on OTP and PIN screens

**Problem**: The hidden `<input readOnly inputMode="none">` elements added previously are ineffective because they have `pointer-events-none` and can never receive focus. The system keyboard persists from the phone input screen or re-appears when the user taps on the page.

**Solution**: Two changes in `src/pages/AuthPage.tsx`:

1. **Remove the useless hidden inputs** — they do nothing since they can't receive focus.

2. **Blur active element on screen transition** — In the `goTo()` function, add `document.activeElement?.blur()` to dismiss any active keyboard when switching to OTP or PIN screens. This ensures the keyboard from the phone input is dismissed.

3. **Prevent focus on tap** — Wrap the OTP/PIN content areas with an `onTouchStart` handler that calls `e.preventDefault()` on the display area (OtpBoxes/PinCircles) to prevent the browser from searching for focusable elements when the user taps those regions.

### Changes

**`goTo()` function** — add `(document.activeElement as HTMLElement)?.blur?.()` at the start to force-dismiss keyboard on every screen transition.

**OtpBoxes wrapper** — add `onTouchStart={(e) => e.preventDefault()}` to the container div.

**PinCircles wrapper** — same touch prevention on the container div.

**Remove** all 3 hidden `<input readOnly inputMode="none">` elements (they serve no purpose).


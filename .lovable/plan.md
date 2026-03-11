

## Remove Custom NumPad, Use Device Keyboard Instead

**What changes**: Remove the circular `NumPad` component from all OTP and PIN screens in `AuthPage.tsx`. Replace it with native `<input>` fields that trigger the device keyboard. Remove the `onTouchStart` preventDefault wrappers.

### Changes in `src/pages/AuthPage.tsx`

1. **Delete the `NumPad` component** (lines 181-212) and the `KEYS` array — no longer needed.

2. **OTP screens** (`register_otp`, `forgot_otp`):
   - Remove `<NumPad onKey={...} onDelete={...} />` 
   - Remove `onTouchStart` wrapper around `OtpBoxes`
   - Add a visible `<Input>` with `type="tel"` `inputMode="numeric"` `maxLength={6}` `autoFocus` that directly sets `otp` state and auto-triggers `onComplete` when 6 digits entered
   - Keep `OtpBoxes` as a visual display above the input (or replace with the input styled similarly)

3. **Login PIN screen** (`login_pin`):
   - Remove `<NumPad variant="dark" ... />`
   - Remove `onTouchStart` wrapper around `PinCircles`
   - Add a visible `<Input>` with `type="password"` `inputMode="numeric"` `maxLength={4}` `autoFocus` that sets `pin` state and auto-triggers `handleLoginPin` when 4 digits entered
   - Keep `PinCircles` as visual display above the input

4. **Registration/Forgot PIN screens** (`register_pin`, `forgot_pin`):
   - Remove `<NumPad onKey={...} onDelete={...} />`
   - Remove `onTouchStart` wrapper around `PinCircles`
   - Add a visible `<Input>` with `type="password"` `inputMode="numeric"` `maxLength={4}` `autoFocus` that feeds into `handlePinKey` / `handleRegisterPin` logic

5. **Remove the `goTo` blur hack** — `(document.activeElement as HTMLElement)?.blur?.()` is no longer needed since we want the keyboard to appear.

6. **Styling**: Inputs will be centered, large text, with `tracking-[1em]` for spaced digits. The visual dot/box displays remain above for aesthetics.

### Summary
Three `NumPad` instances removed, three native inputs added. Device keyboard will naturally appear on focus.


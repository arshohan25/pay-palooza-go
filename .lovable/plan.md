

## Hide system keyboard during OTP and PIN entry

**Problem**: The OTP and PIN screens use a custom numeric keypad (`NumPad`) for input, but when users tap on the visual display boxes (OtpBoxes/PinCircles), the browser's default behavior may trigger the system keyboard. We need to prevent this.

**Solution**: Add hidden input fields with `inputMode="none"` that programmatically receive input without displaying the keyboard, while maintaining the custom keypad UX.

### Changes in `src/pages/AuthPage.tsx`

1. **OTP Screen (`register_otp`, `forgot_otp`)**:
   - Add a hidden `<input>` with `inputMode="none"` and `tabIndex={-1}`
   - Auto-focus this input on screen entry
   - Map input value to `setOtp()`

2. **PIN Screen (`register_pin`, `forgot_pin`)**:
   - Add a hidden `<input>` with `inputMode="none"` 
   - Auto-focus on screen entry
   - Map input to the same `handlePinKey` logic used by NumPad

3. **Login PIN Screen (`login_pin`)**:
   - Add a hidden `<input>` with `inputMode="none"`
   - Auto-focus on screen entry
   - Map input to `handleLoginPin()`

### Implementation details

The hidden input will:
- Be positioned off-screen (`position: absolute; opacity: 0; pointer-events: none`)
- Use `inputMode="none"` to prevent keyboard display
- Capture numeric keypresses via `onChange`
- Have `autoFocus` so it receives focus immediately

This allows users to:
- Use the custom circular keypad
- Use physical keyboard (optional fallback)
- Never see the system keyboard


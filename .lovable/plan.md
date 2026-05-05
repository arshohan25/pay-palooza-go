## Goal
On the login PIN screen (`src/pages/AuthPage.tsx`), move the "Forgot PIN?" action out of the bottom frosted bar and place it directly underneath the PIN entry card, with a refreshed modern-minimal treatment and updated label "Forgot PIN? Reset Now". Keep the Show/Hide PIN toggle accessible.

## Changes (single file: `src/pages/AuthPage.tsx`)

1. **Remove the bottom frosted glass footer bar** (the pill containing Forgot PIN · Show/Hide). Drop the spacer reorder so layout stays balanced.

2. **Add a new minimal action row directly below the PIN frosted card** (right after the closing of the PIN container, before the flex spacer):
   - Text: `Forgot PIN?` in muted white, followed by a brighter `Reset Now` with a small `ArrowRight` icon that nudges right on hover.
   - While OTP is being sent, swap `Forgot PIN?` to the existing `t.sending` label.
   - Vertical divider (1px white/15) then the Show / Hide PIN toggle (Eye / EyeOff) in compact muted style.
   - No background pill — pure text buttons, ~12px, gentle hover color transition; subtle `motion` fade-in (delay 0.5).

3. **Strings**: keep using existing `t.forgotPin` ("Forgot PIN?" / Bangla equivalent) and append a literal `Reset Now` (or `t.reset` + " Now") so it reads "Forgot PIN? Reset Now".

4. **Icons**: import `ArrowRight` from `lucide-react` if not already imported.

No other screens, no logic changes — `handleForgotSendOtp`, `setShowPin`, OTP flow, etc. remain untouched.

## Visual result
```
   [ ENTER PIN ]
   ◯ ◯ ◯ ◯
   ────────────
   Forgot PIN? Reset Now →   |   Show
```
Sits flush under the PIN card, no boxed background, cleaner hierarchy.

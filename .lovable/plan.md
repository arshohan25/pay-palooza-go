

## Replace Name Step with KYC Flow After Registration

**What changes**: After confirming the PIN during registration, instead of showing the name entry screen, the app will create the account immediately and then open the KYC flow so new users can verify their identity right away.

### Changes in `src/pages/AuthPage.tsx`

1. **Import KycFlow** at the top of the file

2. **Add state** for showing KYC flow: `const [showKycAfterRegister, setShowKycAfterRegister] = useState(false);`

3. **Change PIN confirm handler** (line 386): After PIN confirmation, instead of `goTo("register_name")`, immediately create the account (call `signUp` with phone + pin, no name), then on success show KYC flow overlay

4. **Remove or skip `register_name` mode** from the registration flow — the `register_name` UI block and `handleRegisterName` logic get merged into a new `handlePostPinSignup` function that:
   - Calls `signUp(phone, pin)` (no name)
   - Validates device fingerprint
   - On success, sets `showKycAfterRegister = true` instead of going to "success"

5. **Render KycFlow** when `showKycAfterRegister` is true, with an `onClose` that navigates to "success" and calls `onAuthenticated`

6. **Update step indicator** — registration becomes 3 steps (phone → OTP → PIN) instead of 4

### Flow Summary

```text
Before: Phone → OTP → PIN → Name → Success
After:  Phone → OTP → PIN → Account Created → KYC Flow → Success
```

The referral code input currently on the name screen will be moved into the PIN confirmation step or removed (users can add it later). The name can be collected during KYC (the KYC flow already captures full name from NID).


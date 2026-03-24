

## Plan: Test 2FA OTP Flow for staff-SA88

### Current State
- `staff-SA88` has `email: null` and `has_changed_password: false`
- Because there's no email, the 2FA step is skipped entirely after login
- The password hasn't been changed yet, so login will trigger the forced password change dialog first

### Steps to Test

**1. Update staff-SA88's record**
- Set `email = 'test@example.com'` on the `team_members` row
- Set `has_changed_password = true` to skip the forced password change dialog and isolate the 2FA flow

**2. Log in at `/team-login`**
- Username: `staff-SA88`
- Password: `DAw35zTa` (the original temp password, since has_changed_password will be set to true)
- After successful auth, the code checks `tm.email` → finds `test@example.com` → triggers OTP send

**3. Verify the OTP dialog appears**
- The `send-email-otp` edge function is called with `{ email: "test@example.com", purpose: "team_2fa" }`
- A toast shows "Verification code sent to te***@example.com"
- The 2FA dialog renders with 6-digit OTP input, verify button, and resend option

**4. Verify OTP**
- Query `otp_codes` table for the generated code
- Enter the code in the OTP dialog
- Confirm successful verification redirects to `/admin`

**5. Test edge cases**
- Wrong code → "Invalid or expired OTP" error
- Resend button with 30s cooldown
- Already-verified code rejected on replay

### Files Modified
- No code changes needed — only database updates and manual testing


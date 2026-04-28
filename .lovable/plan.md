# Skip device-verified confirmation screen

Today, after a trusted-device check (returning login) or a successful OTP (first login), users see a "You're all set / Continue to dashboard" page with a tap-through button. The user wants to bypass that screen and land directly on the dashboard.

## Changes

### 1. `src/pages/MerchantLoginPage.tsx`
- Remove the `"confirm"` step from the `Step` union and stop rendering `<DeviceVerifiedConfirm />`.
- Both code paths that previously called `setStep("confirm")` (returning trusted device + post-OTP session) will instead call the existing `handleConfirmContinue()` logic inline:
  - Call `supabase.auth.setSession({ access_token, refresh_token })` immediately.
  - Persist `mfs_device_phone` + `mfs_has_authenticated`.
  - `toast.success("Welcome back, merchant!")` and `navigate(redirectTarget, { replace: true })`.
- Remove `confirmLoading` state + the `DeviceVerifiedConfirm` import. Keep the OTP step intact.

### 2. `src/pages/AuthPage.tsx` (User / Agent / Distributor / Super Distributor portals)
- Drop the `"confirm"` value from `devicePhase` (`"none" | "otp"` only).
- Trusted returning user (line 599): instead of `setDevicePhase("confirm")`, immediately fire the same finalization that `handleDeviceContinue()` runs — go to `"success"` screen and call `onAuthenticated()` after the brief delay. No trust-token mint needed (no fresh OTP ticket).
- Successful OTP verify (line 647): instead of `setDevicePhase("confirm")`, call `handleDeviceContinue()` directly so the OTP ticket is exchanged for a device trust token and the user is then forwarded to `"success"` → `onAuthenticated()`.
- Remove the `devicePhase === "confirm"` render branch and the `<DeviceVerifiedConfirm />` import.

### 3. Optional cleanup
- `src/components/DeviceVerifiedConfirm.tsx` becomes unused. Leave the file in place (no other refs) or delete it — I'll delete it to keep the tree clean.

## What stays the same
- Server-side device trust gate, OTP minting, trust-token issuance, and the OTP entry screen are all unchanged.
- A small "Welcome back" toast on the merchant side preserves the feedback that the previous confirm screen provided.
- First-time users still see the OTP step; only the post-success "tap to continue" page is removed.

## Files touched
- `src/pages/MerchantLoginPage.tsx` — remove confirm step, auto-finalize session.
- `src/pages/AuthPage.tsx` — remove confirm phase, auto-finalize after trusted check / OTP verify.
- `src/components/DeviceVerifiedConfirm.tsx` — delete (no longer referenced).

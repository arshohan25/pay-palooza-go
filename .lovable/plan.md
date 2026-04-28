## Goals

1. Fix the masked phone format to exactly `+88 019•••••954` (prefix `+88`, 5 middle dots, last 3 visible).
2. Lock the device to the bound merchant account: once a device has a verified merchant binding, the user cannot switch numbers or sign into a different merchant from the login page. Switching requires clearing app data / browser storage.

## Changes

### 1. Mask format — `+88 019•••••954`

**`src/components/merchant/MerchantForgotPinSheet.tsx`**
- Update `maskBdPhone()` to return 5 dots instead of 6:
  `${clean.slice(0,3)}•••••${clean.slice(8)}` → produces `019•••••954`.

**`src/pages/MerchantLoginPage.tsx`** and **`src/pages/MerchantManagerLoginPage.tsx`**
- Change displayed prefix from `+880` to `+88` in the masked chip so the full label reads `+88 019•••••954`.
- Keep "Middle digits hidden for privacy" sub-label.
- Update the Forgot-PIN sheet's masked preview to also render `+88` (it currently shows whatever prefix the sheet uses).

Verify any other `+880 {maskBdPhone(...)}` occurrences (manager login, forgot-pin sheet body) and align them all to `+88`.

### 2. Hard device lock once bound

Currently the masked chip shows an `×` button that calls `localStorage.removeItem("mfs_device_phone")` + `clearDeviceToken(...)` and lets the user type a new number. We will remove that escape hatch on both merchant login pages.

**`src/pages/MerchantLoginPage.tsx`** + **`src/pages/MerchantManagerLoginPage.tsx`**

When `boundPhone` is set:
- Remove the `×` "use a different number" button entirely.
- Replace the helper text "Not you? Tap × to use a different number." with a locked notice:
  > "This device is locked to this merchant account. To use a different number, clear app data in your browser settings."
- Add a small lock icon (`Lock` from lucide-react) inside the chip to signal the binding is permanent.
- Keep the Forgot-PIN button visible (so a locked-out owner can still request help via support ticket).

We do not change the server flow — `merchant-login` already requires a matching device token + OTP ticket. The login form simply no longer offers a UI path to overwrite the local `mfs_device_phone` flag, so the bound phone is the only number that can be entered from this device.

### Notes on scope

- Server-side `trusted_devices` row is already keyed to `(user_id, device_fp, portal)`, so even if the user manipulates localStorage manually they will still need a fresh OTP to bind a new account. The UI lock + the existing OTP gate together deliver the requested behavior.
- "Clear app data" is the documented recovery path; this matches Bangladeshi MFS norms (bKash, Nagad behave the same way).
- No DB / edge-function changes needed.

### Files touched

- `src/components/merchant/MerchantForgotPinSheet.tsx` — mask helper.
- `src/pages/MerchantLoginPage.tsx` — chip prefix, remove × button, add lock notice.
- `src/pages/MerchantManagerLoginPage.tsx` — same as above with sky accent.

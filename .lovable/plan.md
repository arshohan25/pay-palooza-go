

# Show KYC Badge Based on Actual Verification Status

## Problem
The Account page always renders `<KycBadge verified />` (hardcoded `true`), so every user sees "Verified" even if they haven't completed KYC.

## Fix

### `src/pages/AccountPage.tsx`
1. Import `useKycStatus` hook (already used elsewhere in the app)
2. In the component body, call `const { status: kycStatus } = useKycStatus();`
3. Change line 251 from `<KycBadge verified />` to `<KycBadge verified={kycStatus === "verified"} />`

The existing `KycBadge` component already handles both states (green "Verified" vs red "Unverified"), so no other changes needed.

## Files Changed
- `src/pages/AccountPage.tsx` — 3 lines (add import, add hook call, fix prop)


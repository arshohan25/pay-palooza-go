

# Hide KYC Banner During Loading State

## Problem
The KYC banner on the home page shows briefly during initial load because `kycStatus` defaults to `"none"` while the hook is still fetching. Verified and exempt users see a flash of "Complete KYC to unlock all features" before it disappears.

## Fix

### `src/pages/Index.tsx`
1. Destructure `loading: kycLoading` from `useKycStatus()` (line 72)
2. Update the banner condition (line 293) from:
   - `kycStatus !== "verified"`
   - to: `!kycLoading && kycStatus !== "verified"`

This ensures the banner is never rendered while KYC status is being fetched, eliminating the flash for verified/exempt users.

## Files Changed
- `src/pages/Index.tsx` — 2-line change (add `loading` destructure, update condition)


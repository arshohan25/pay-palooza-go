

# Add Pending KYC Badge (Yellow/Orange)

## Problem
The `KycBadge` component on the Account page only has two states: Verified (green) and Unverified (red). Users who have submitted KYC but are awaiting review still see "Unverified" in red, which is misleading.

## Changes

### 1. `src/pages/AccountPage.tsx`
- Update `KycBadge` to accept `status: KycStatus` instead of `verified: boolean`
- Add a third state: **Pending** — displayed as a yellow/orange badge with a `Clock` icon and "Pending" label
- Three states:
  - `verified` → green badge with checkmark, "Verified"
  - `pending` → amber/orange badge with clock icon, "Pending"
  - `none` / `rejected` → red badge with alert icon, "Unverified"
- Update the call site from `<KycBadge verified={kycStatus === "verified"} />` to `<KycBadge status={kycStatus} />`

### 2. `src/lib/i18n.tsx`
- Add translation key `kycPending` with `{ en: "Pending", bn: "অপেক্ষমাণ" }` (can reuse existing `pending` key if already suitable)

## Technical Details
- Import `Clock` icon from lucide-react for the pending state
- Amber styling: `bg-amber-500/12 text-amber-600 border-amber-500/20`
- The existing `useKycStatus()` hook already returns `"pending"` status, so no backend changes needed

## Files Changed
- `src/pages/AccountPage.tsx` — Update KycBadge component and its usage
- `src/lib/i18n.tsx` — Add `kycPending` translation key (if needed)


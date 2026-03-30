

# Fix KYC Badge Loading Flash on Account Page

## Problem
The `KycBadge` renders immediately with default status `"none"` (red "Unverified") while the hook is still fetching, causing a flash for verified/pending users.

## Fix

### `src/pages/AccountPage.tsx`
1. Destructure `loading` from `useKycStatus()` on line 147:
   - `const { status: kycStatus, loading: kycLoading } = useKycStatus();`
2. Update `KycBadge` component to accept an optional `loading` prop — when `true`, render a small skeleton pill instead of any status badge
3. Pass loading to badge: `<KycBadge status={kycStatus} loading={kycLoading} />`

### Technical detail
- The skeleton pill will use the existing `Skeleton` component with matching dimensions (`w-16 h-4 rounded-full`)
- Once loading resolves, the correct badge (Verified/Pending/Unverified) appears without any flash

## Files Changed
- `src/pages/AccountPage.tsx` — Add loading prop to KycBadge, show skeleton while loading


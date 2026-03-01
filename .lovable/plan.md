

## Plan: KYC Stats Card + Verified Status Check

### 1. Add KYC Statistics Summary Card to AdminKycReview

At the top of `src/components/admin/AdminKycReview.tsx`, above the filter bar:
- Compute counts from loaded records (or fetch separate counts for all statuses)
- Render 3 stat cards in a row: **Pending** (amber), **Verified** (green), **Rejected** (red) with counts and icons
- Use the existing `records` state plus a separate count query to get totals across all statuses (since `records` is filtered)

**Implementation**: Add a `useEffect` that fetches counts for each status via 3 parallel `select("id", { count: "exact", head: true })` queries with `.eq("status", ...)`. Display in a 3-column grid of small stat cards.

### 2. Show "KYC Verified" Status in KycFlow

In `src/components/KycFlow.tsx`:
- Add a `useEffect` on mount that checks if the current user already has a `kyc_verifications` record with `status = 'verified'`
- If verified, show a success screen (green shield icon, "Your KYC is verified" message, close button) instead of the intro step
- Add a new state like `kycStatus` (`null | "pending" | "verified" | "rejected"`) and a loading state
- When `kycStatus === "verified"`, render a fullscreen verified badge instead of the normal flow
- When `kycStatus === "pending"`, optionally show "Your KYC is under review" with a close button

### Files to modify:
- `src/components/admin/AdminKycReview.tsx` — add stats summary card
- `src/components/KycFlow.tsx` — add existing KYC status check on mount


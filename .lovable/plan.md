

# Enforce KYC on All Unguarded Pages

## Problem
Six standalone route pages allow financial actions **without any KYC check**:
- `/donations` — DonationsPage (accepts donations with PIN/balance deduction)
- `/loan` — LoanPage (loan applications)
- `/insurance` — InsurancePage (insurance purchases)
- `/giftcards` — GiftCardsPage (gift card purchases)
- `/coupons` — CouponsPage (coupon usage)
- `/refer` — ReferPage (referral rewards — read-only, low risk)

The modal-based flows (Send Money, Cash Out, Payment, etc.) are properly guarded by `FeatureGuard`, but these page-based flows bypass KYC entirely.

## Solution
Add a **KYC gate** at the top of each financial page that redirects unverified users back to home with a toast message. Use the existing `useKycStatus` hook.

### Pages to protect (require KYC)
1. **DonationsPage** — involves balance deduction
2. **LoanPage** — financial product
3. **InsurancePage** — financial product
4. **GiftCardsPage** — involves balance deduction

### Pages to leave unprotected
- **CouponsPage** — browsing coupons is harmless (actual purchase goes through guarded checkout)
- **ReferPage** — read-only referral info, no financial action

### Implementation pattern (same for all 4 pages)
```tsx
import { useKycStatus } from "@/hooks/use-kyc-status";

// Inside component:
const { status: kycStatus, loading: kycLoading } = useKycStatus();

useEffect(() => {
  if (!kycLoading && kycStatus !== "verified") {
    toast.error("Please complete KYC verification to use this feature.");
    navigate("/");
  }
}, [kycLoading, kycStatus]);

if (kycLoading) return <loading skeleton>;
```

### Server-side enforcement
The `record_transaction` RPC already enforces KYC for non-exempt types, and `donations`, `gift_cards`, `loan`, `insurance` transaction types are NOT in the exempt list — so server-side is already covered. This change adds the missing client-side guard.

## Files Changed
- `src/pages/DonationsPage.tsx` — add KYC gate
- `src/pages/LoanPage.tsx` — add KYC gate
- `src/pages/InsurancePage.tsx` — add KYC gate
- `src/pages/GiftCardsPage.tsx` — add KYC gate


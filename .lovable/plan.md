# Merchant Vendor Gating — Already in Place, Minor Polish

## Current behavior (verified)

When any user opens `/merchant`, `MerchantDashboard` checks `user_roles` for the `merchant` role.

- If the user does **not** have the `merchant` role → renders `MerchantBenefitsPage` (the onboarding/marketing page) with the **"Apply as Vendor"** button that opens `MerchantBusinessKycFlow`.
- If they have applied and KYC is `pending` → button becomes **"View Application Status"** with an amber pill.
- If `rejected` → **"Reapply Now"** with the rejection reason.
- If `approved` → **"Go to Merchant Dashboard"** + verified pill, refresh enters the dashboard.

The full vendor dashboard (Products, Orders, Store, API, etc.) is **never rendered** until `isMerchant === true`. So by default a normal user cannot use any vendor features — they only see the onboarding screen and the apply button. This matches your requirement.

## Small improvements to tighten it

1. **Loading flash** — While `isMerchant === null`, the page briefly renders the dashboard skeleton. Show a lightweight loader so non-merchants never glimpse vendor UI.
2. **Auto-refresh on approval** — Today the user must tap "Go to Merchant Dashboard" (which calls `window.location.reload()`). Subscribe to `user_roles` realtime for the current user; when the `merchant` role is inserted, refetch automatically — no manual reload.
3. **Copy consistency** — The CTA says "Apply as Vendor" but the page header says "Become a Merchant". Align both to "Vendor" (matches Shop terminology) or both to "Merchant". Pick one.
4. **Guard against direct deep-links** — Sub-routes like `/merchant/orders` or `/merchant/products` (if any nested links exist) should also funnel through this same role check. Verify and add the same gate where missing.

## Files touched

- `src/pages/MerchantDashboard.tsx` — add loader state, realtime role subscription, copy alignment.
- (No DB migrations needed — `user_roles` is already in the realtime publication for role-based UIs; will verify and add if missing.)

## Out of scope

- No changes to the application/KYC flow itself.
- No changes to admin approval logic.

Confirm and I'll implement, or tell me which of the 4 polish items to skip.

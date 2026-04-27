# Vendor Onboarding Checklist on `MerchantBenefitsPage`

A premium 5-step checklist that drives the user from first visit to live vendor — with a glass progress ring, animated step rows, and per-step deep-link CTAs. Completion is derived from the existing database tables (no shadow state to drift).

## The 5 steps

| # | Step | Source of truth | CTA when incomplete |
|---|---|---|---|
| 1 | Verify your identity (personal KYC) | `profiles.kyc_status = 'verified'` | "Complete KYC" → opens KYC flow |
| 2 | Submit business application | `merchant_applications` row exists for user | "Apply as Vendor" → opens `MerchantBusinessKycFlow` |
| 3 | Application approved by admin | `merchants.business_kyc_status = 'approved'` | "Awaiting review" (disabled) / shows rejection reason if rejected |
| 4 | Add your first product | `products` count for merchant > 0 | "Add product" → reload into dashboard, navigate to Products tab |
| 5 | Configure store & go live | `merchants.store_active = true` (or equivalent) | "Open store settings" |

Steps 4–5 only become reachable after step 3 completes (the page itself unmounts and the dashboard takes over via the auto-refresh we just added). So the checklist visually shows steps 4–5 as "unlocks after approval" with a soft lock icon — they reassure the user about what's coming next without being actionable yet.

## Why no new "checklist" table

Every step is already a deterministic function of existing DB rows. A separate `onboarding_checklist` table would either:
- duplicate the same data (drift risk), or
- store user-dismissed flags only — which the user didn't ask for.

The "saved to database" requirement is met because **completion state lives in the database** (KYC, application, merchants, products) and is read in real time. If you actually want a per-step "user marked done" override (e.g., dismiss step 5), we can add a thin `merchant_onboarding_progress` table later — flag if needed.

## Real-time

Subscribe to `postgres_changes` on `profiles` (kyc_status), `merchant_applications` (status), and `merchants` (business_kyc_status) for the current user. Each step row animates from grey → amber (in progress) → emerald (done) the moment the underlying row changes. Matches the project's zero-refresh policy.

## Visual design

- Top: circular progress ring (e.g., "2 / 5 complete") with gradient stroke matching the page hero (`hsl(24 90% 50%) → hsl(350 65% 35%)`).
- Step rows: glass card, 19px radius, with a numbered status pill (✓ done / ⏳ in progress / 🔒 locked / number when pending).
- Each row: title, one-line description, inline CTA button (only on the active actionable step).
- Estimated time chip per step ("~2 min").
- A subtle "Next: …" hint below the ring pointing at the active step.
- Animated entrance with `framer-motion` stagger — same `stagger.container/item` pattern already used on the page.
- Placed **above** the "Why Become a Vendor?" benefits grid (high above the fold) and **below** the stats strip.

## Files to change

- `src/pages/MerchantDashboard.tsx` — add a `<VendorOnboardingChecklist />` component (defined in the same file, sibling to `MerchantBenefitsPage`); render it inside `MerchantBenefitsPage`'s content column. Wire its CTA for step 2 to the existing `setKycFlowOpen(true)`. Step 1 CTA opens the existing personal KYC flow (re-use `KycVerificationFlow` if imported elsewhere; otherwise navigate to `/account` where KYC is initiated).
- No DB migration needed.

## Out of scope (will not do unless asked)

- A "dismiss step" feature.
- Persisting checklist progress separately from source-of-truth tables.
- Adding the checklist to the post-approval dashboard (it auto-unlocks; steps 4–5 belong inside the live dashboard if you want, but you asked for it on `MerchantBenefitsPage`).

Approve and I'll implement.

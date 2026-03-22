

## Complete Remaining User App Flows + Admin Toggle Control

### Summary
Three user-facing features are marked "Coming soon" with no actual implementation: **Loan**, **Insurance**, and **Gift Cards**. Additionally, **Coupons** is marked `soon: true` in QuickActions even though it has a working page. This plan builds out all three missing flows as functional pages and wires them into the toggle system.

### Changes

#### 1. Fix Coupons — Remove `soon: true`
- In `QuickActions.tsx`, change coupons from `soon: true` to `soon: false` and wire the tap handler to navigate to `/coupons`

#### 2. Create Loan Application Flow (`src/pages/LoanPage.tsx`)
- Simple loan application page with:
  - Loan amount selector (preset amounts: ৳1000, ৳5000, ৳10000, ৳25000, ৳50000)
  - Tenure picker (30/60/90/180 days)
  - Interest rate display and EMI calculator
  - Eligibility check (based on transaction history count)
  - Application submission (stores in a new `loan_applications` table)
  - Application status tracker showing pending/approved/rejected/disbursed
- Route: `/loan`, accessible from QuickActions

#### 3. Create Insurance Flow (`src/pages/InsurancePage.tsx`)
- Insurance marketplace page with:
  - Plan categories: Life, Health, Accident, Device Protection
  - Plan cards with coverage amount, premium, and duration
  - Plan detail view with benefits list
  - Purchase flow: select plan → confirm details → PIN → success
  - Stores in a new `insurance_policies` table
- Route: `/insurance`, accessible from QuickActions

#### 4. Create Gift Cards Flow (`src/pages/GiftCardsPage.tsx`)
- Gift card purchase and redemption page with:
  - Browse available gift card brands/categories
  - Select denomination (৳100, ৳250, ৳500, ৳1000, ৳2000)
  - Purchase flow with PIN confirmation
  - "My Gift Cards" section showing purchased cards with codes
  - Share gift card via copy/share
  - Stores in a new `gift_cards` table
- Route: `/giftcards`, accessible from QuickActions

#### 5. Wire into QuickActions (`src/components/QuickActions.tsx`)
- Change `soon: true` to `soon: false` for loan, insurance, giftcards, coupons
- Add navigation handlers for all four in `handleMoreService`

#### 6. Wire into MoreSheet (`src/components/MoreSheet.tsx`)
- Add Loan, Insurance, Gift Cards items with proper icons and navigation

#### 7. Add Routes (`src/App.tsx`)
- Add `/loan`, `/insurance`, `/giftcards` routes

#### 8. Database Migration
Create 3 new tables:

**`loan_applications`**: id, user_id, amount, tenure_days, interest_rate, emi_amount, status (pending/approved/rejected/disbursed/repaid), applied_at, reviewed_at, notes

**`insurance_policies`**: id, user_id, plan_type, plan_name, coverage_amount, premium, duration_months, status (active/expired/cancelled/claimed), purchased_at, expires_at

**`gift_cards`**: id, purchaser_id, recipient_phone, brand, denomination, code, status (active/redeemed/expired), purchased_at, redeemed_at, redeemed_by

All with RLS policies (users see only their own records, admins see all).

#### 9. Add Toggle Keys (Database Insert)
Insert 3 rows into `global_feature_toggles`:
- `loan` → "Loan"
- `insurance` → "Insurance"  
- `gift_cards` → "Gift Cards"

(These already exist in `FEATURE_MAP` and the toggles table likely has some — will use `ON CONFLICT DO NOTHING`)

#### 10. Update Admin Global Toggles
Ensure `loan`, `insurance`, `gift_cards` keys are recognized and grouped properly in `AdminGlobalToggles.tsx` (they should already fall under the "Services" section matcher).

### Technical Notes
- All three flows follow existing patterns: header with back button, card-based content, motion animations, PIN confirmation for purchases
- Each flow is self-contained with local state, fetching from its own table
- RLS: `user_id = auth.uid()` for user access, `has_role(auth.uid(), 'admin')` for admin access
- Toggle filtering already works via `useGlobalToggles` in QuickActions — just needs `soon: false`


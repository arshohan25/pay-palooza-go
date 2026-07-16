## Goal
Unify the 4-level BD location picker everywhere, seed City Corporations + Powrashavas, deep-link the merchant apply flow, and enforce apply-once + parent-child validation server-side.

## 1. Database (single migration + seed insert)

**Schema**
- `unions` table: add `type` values already exist (`union|powrashava|city_corporation`); add unique `(division, district, upazila, name, type)`; ensure `is_active` default true.
- New function `public.validate_location_hierarchy(_division, _district, _upazila, _union, _type) returns boolean` (SECURITY DEFINER, checks upazilas + unions rows match).
- Trigger `merchant_applications_validate_location_trg` BEFORE INSERT/UPDATE: raise if hierarchy invalid.
- Same trigger reused on `agents`, `distributors`, `merchants`, `merchant_vendor_applications` (any table that stores the 4 fields).
- New RPC `public.check_merchant_apply_access(p_user_id uuid)` already exists — extend to return `{ can_apply, reason, status }` where status is latest application `pending|approved|rejected|null`. Block `pending` + `approved`; allow `rejected`.

**Seed**
- Insert all 12 BD City Corporations as `type='city_corporation'` rows keyed to their parent district/upazila (Dhaka North, Dhaka South, Chattogram, Khulna, Rajshahi, Sylhet, Barishal, Rangpur, Cumilla, Gazipur, Narayanganj, Mymensingh).
- Insert curated ~330 Powrashavas mapped division→district→upazila (bundled JSON, batched INSERT ... ON CONFLICT DO NOTHING).
- Insert commonly-used unions per district (best-effort curated list — remainder still falls back to free-text).

## 2. Unified picker

- Extend `DivisionDistrictUpazilaPicker`:
  - Auto-set `area_type='city_corporation'` if any CC exists for the upazila and pre-select the CC.
  - When `type` is chosen, filter dropdown to that type only; if list empty, show free-text input with hint.
  - New prop `compact?: boolean` for admin table forms.
- Delete legacy `DivisionDistrictPicker` (unused after refactor) — keep only if a test needs it; otherwise re-export a thin shim.

**Refactor call-sites to the unified picker + persist all 4 fields:**
- `src/components/MerchantApplicationFlow.tsx` (done — verify)
- `src/pages/MerchantApplyVendor.tsx`
- `src/components/MerchantBusinessKycFlow.tsx`
- `src/components/MerchantStoreSettingsTab.tsx`
- `src/pages/DistributorCreateAgent.tsx`
- `src/pages/SuperDistributorCreateDistributor.tsx`
- `src/components/admin/AdminAgentHub.tsx`
- `src/components/admin/AdminProfileEditor.tsx`
- Keep legacy `DistrictRoutePicker` only where a single route-code is needed (wallet route code) — but layer the 4-level picker on top so district selection is driven by the same hierarchy.

## 3. Deep-linking

- Add route `/merchant/apply` in `src/App.tsx` → new page `MerchantApplyPage.tsx` that renders `MerchantApplicationFlow` full-screen with `open={true}`, closes to `/merchant-login`.
- `/merchant-login?apply=1` also auto-opens the modal (reads `useSearchParams`).
- Handle unauthenticated deep-link: redirect to `/merchant-login?apply=1&next=/merchant/apply` and re-open after login.
- On close/submit: `navigate("/merchant-login", { replace: true })` so back button doesn't reopen.
- Guard route with `useMerchantApplyAccess` — if `can_apply=false`, render status page (pending/approved/rejected banner + link back to login) instead of the form.

## 4. Apply-once enforcement

- Client: `useMerchantApplyAccess` already exists; wire into new `/merchant/apply` route + `MerchantLoginPage` "Apply as a merchant" button (hide/disable + tooltip when blocked).
- Server: update `check_merchant_apply_access` SQL to return `can_apply=false` when latest application is `pending` or `approved`. Add RLS/`BEFORE INSERT` trigger on `merchant_applications` that raises if same `user_id` already has a `pending`/`approved` row.

## 5. Error fixes surfaced along the way

- Fix union dropdown "empty option" bug (currently renders two `<option value="">` — the "Type manually below" and the placeholder collide).
- Fix `area_type` reset when division changes (already correct — verify).
- Type-safety: regenerate `types.ts` after migration; update `MerchantApplicationFlow` submit payload types.

## Files touched (summary)
- SQL: 1 migration + 1 large seed insert (via insert tool for data rows).
- Modified: 8 forms + `App.tsx` + `MerchantLoginPage.tsx` + `DivisionDistrictUpazilaPicker.tsx` + `use-merchant-apply-access.ts`.
- New: `src/pages/MerchantApplyPage.tsx`, `src/components/merchant/MerchantApplyStatusPage.tsx`.
- Removed: `DivisionDistrictPicker.tsx` (or shim).

## Tests
- Update `division-district-picker.test.tsx` + `district-picker-roundtrip.test.ts` for new picker shape.
- Add unit test: `validate_location_hierarchy` rejects mismatched parent/child.

## Out of scope
- Bulk migrating historical merchant/agent rows with missing new fields — will backfill to NULL and let admins re-edit; trigger only fires on new INSERT/UPDATE of these columns.
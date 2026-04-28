# Dedicated Manager Login Screen

The current `/merchant-login` page can toggle into a "manager" mode via a small footer button — easy to miss and confusingly worded. We'll give Managers a real, dedicated entry point with messaging that explains they must use **their own phone number and PIN** (the one tied to their personal EasyPay account), not the owner's.

## Goals
- A standalone Manager login route with clear, friendly explainer copy.
- Cross-links between Owner and Manager login screens (no more easy-to-miss toggle).
- No backend changes — the existing `merchant-login` edge function already handles `mode: "manager"` and the staff role check.

## What gets built

### 1. New route: `/merchant-manager-login`
A new page `src/pages/MerchantManagerLoginPage.tsx` that:
- Reuses the same glass UI, lockout, OTP/device-trust flow as `MerchantLoginPage` but hard-locks `loginMode = "manager"`.
- Shows a prominent **info card** above the form:
  > **Use your own phone & PIN** — Sign in with the personal EasyPay account that the store owner invited. Don't use the owner's number. New to EasyPay? Sign up first, then ask the owner to add you.
- Header eyebrow: "Store Manager Access", title "Manager sign-in".
- Submit button: "Sign in as Manager".
- Footer link: "Are you the store owner? → Owner login" → navigates to `/merchant-login`.
- Removes the "Apply as a merchant" CTA (irrelevant for managers); replaces with "Don't have an EasyPay account? Sign up" → `/auth`.
- On success, navigates to `redirect` param (default `/merchant`), same as owner flow.

### 2. Update `/merchant-login` (Owner)
- Remove the bottom mode-toggle button (`Sign in as Manager instead`).
- Replace with a clean link: **"Manage a store as staff? → Manager login"** → `/merchant-manager-login`.
- Strip out all `loginMode === "manager"` conditionals to simplify (page is owner-only now).

### 3. Routing
- Add `<Route path="/merchant-manager-login" element={<MerchantManagerLoginPage />} />` in `src/App.tsx` next to the existing merchant-login route.
- Lazy-load like neighboring pages.

### 4. Cross-links elsewhere
- In `MerchantStaffTab.tsx` (the invitation UI), the success toast / staff row already mentions the invitee should log in. We'll update the helper text shown after adding a staff member to: *"Ask them to sign in at the **Manager login** page using their own phone & PIN."* — no behavioral change, just wording.

## Technical Notes
- The new page is essentially `MerchantLoginPage.tsx` with `loginMode` removed (always `"manager"`), the info card added, and the footer CTAs swapped. To avoid duplication drift, we extract the shared form/OTP logic only if it stays simple — otherwise we copy and trim, since the two screens will diverge in messaging over time.
- No DB or edge function changes. The `merchant-login` function already enforces `get_staff_merchant_access` + `staff_role === 'Manager'` when `mode: "manager"`.
- Lockout storage key stays `mfs_merchant_login_locked_until` (shared with owner page) since it's keyed per device, and a wrong PIN is a wrong PIN regardless of which screen submitted it.

## Files
- **Create**: `src/pages/MerchantManagerLoginPage.tsx`
- **Edit**: `src/pages/MerchantLoginPage.tsx` (remove toggle, add owner-only copy + manager link)
- **Edit**: `src/App.tsx` (register route)
- **Edit**: `src/components/merchant/MerchantStaffTab.tsx` (invitation helper text)

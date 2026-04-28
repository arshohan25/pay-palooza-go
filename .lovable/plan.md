# Merchant Login — Polish + Manager Login

Four focused changes to `MerchantLoginPage.tsx` (and a small new piece for Manager login). Nothing else in the app changes.

---

## 1. Fit on one screen — no scroll

Current page overflows on a 390×638 viewport because of the logo block, eyebrow, perks strip, trust pills, and footer all stacking. Tighten vertical rhythm so everything fits without scroll on mobile.

Concrete tweaks inside the existing layout:

- Outer wrapper: `py-10` → `py-4`, switch `items-center` to `items-start` with `pt-6` so the card hugs the top on short screens.
- Logo block (`mb-6` → `mb-4`):
  - Logo box `h-16 w-16` → `h-12 w-12`, icon `h-8 w-8` → `h-6 w-6`.
  - Drop the long subtitle paragraph; keep just the eyebrow chip + `h1` (one line).
  - `h1` `text-3xl` → `text-2xl`, `mt-3` → `mt-2`.
- Card padding: `p-6 sm:p-7` → `p-5`.
- PIN slots: `h-12 w-12` → `h-11 w-11`, container `p-3` → `p-2.5`.
- Submit button: `h-12 mt-6` → `h-11 mt-5`.
- **Remove** the "Trust pills" row (Secure PIN / Encrypted / Bank-grade) — purely decorative.
- **Remove** the "Perks strip" (Orders / Payouts / QR / Insights) — purely decorative.
- Footer: collapse the three items (Apply, Customer login, Staff login) into a single tight row, `mt-4` instead of `mt-6`.

Net result: ~180–220 px shorter, fits 390×638 with margin to spare.

## 2. PIN auto-hides — remove the eye toggle

- Delete the `showPin` state and the Show/Hide button at lines ~528-535.
- Set the OTP slots to always-masked using the same CSS technique already used when `!showPin`:
  ```tsx
  style={pin[i] ? { color: "transparent", textShadow: "0 0 0 white", caretColor: "transparent" } : undefined}
  ```
- Keep `inputMode="numeric"` behavior (already on InputOTP).

## 3. "Become a merchant" opens the application sheet inline

Currently the link `navigate("/merchant")` just bounces back to the merchant home. Instead, open the existing `MerchantApplicationFlow` sheet right from the login page (same component used by `/account` and home).

- Lazy-import `MerchantApplicationFlow` in `MerchantLoginPage.tsx`.
- Add `const [showApply, setShowApply] = useState(false)`.
- Footer button "New here? Apply as a merchant" → `onClick={() => setShowApply(true)}`.
- Render `<Suspense><MerchantApplicationFlow open={showApply} onOpenChange={setShowApply} /></Suspense>` at the end of the page.

No routing changes; reuses the proven flow.

## 4. Manager / Staff login — proper, professional flow

Today the code already supports merchant staff (`merchant_staff` table, `useStaffAccess` hook, `MerchantDashboard` already restricts tabs by `staffRole`: Manager / Cashier / Viewer). What's missing is a **dedicated entry point** from the merchant login page.

The footer currently says "Staff login" and routes to `/team-login` — that page is for **EasyPay internal employees** (admins/compliance/etc.), not for merchant-shop staff. That's the bug we're fixing.

### How it will work (no schema changes needed)

Merchant staff are already EasyPay users (their `phone` matches a `profiles.phone`, which auto-links via `resolve_staff_user` trigger to `merchant_staff.user_id`). So a manager simply signs in with their **own** EasyPay phone + PIN, and the dashboard automatically loads in "staff mode" because `useStaffAccess()` returns their `merchant_id` + role.

So the flow is:

1. On `MerchantLoginPage`, add a small toggle/segmented control above the form:
   ```
   [ Merchant Owner ]   [ Manager / Staff ]
   ```
2. **Owner mode** (default) — current behavior unchanged: calls `merchant-login` edge function, requires merchant role, OTP-on-new-device, etc.
3. **Manager mode** — different code path:
   - Validates phone + 4-digit PIN with the standard customer auth (`supabase.auth.signInWithPassword` using `${phone}@easypay.app` / `${pin}EP` — same convention used everywhere).
   - After sign-in, call `supabase.rpc("get_staff_merchant_access", { p_user_id })`.
   - If the RPC returns 0 rows → sign out, toast "This number isn't linked to any merchant store. Ask the merchant owner to add you in Staff settings." and stay on login.
   - If it returns ≥1 row and the linked `merchant_staff.is_active = true` → set `localStorage.mfs_device_phone`, navigate to `/merchant`. The dashboard's existing `useStaffAccess` hook handles the rest (badge "Staff · Manager", restricted tab list, no API tab, no apply banner).
   - Inactive (`is_active = false`) → sign out, toast "Your staff access has been disabled."
   - **Lockout reuse**: still goes through `check_merchant_login_lockout` semantics — easiest is to call the same `merchant-login` edge function with a new `mode: "staff"` flag (see Technical section). Keeps brute-force protection consistent.

4. Footer "Staff login" link — repurpose: rename to **"EasyPay team login"** and keep pointing to `/team-login` (that's what it actually is). The new in-page toggle replaces it for merchant staff.

### What managers see (already implemented)

Verified in `MerchantDashboard.tsx` (lines 171-204, 447-449, 464, 669):

- Header badge: `Staff · Manager` (or Cashier / Viewer).
- **Manager** allowed tabs: orders, products, customers, refunds, coupons, payouts, store, analytics, inbox (everything except **API access** and **Staff settings**).
- **Cashier**: orders, products, customers, inbox.
- **Viewer**: analytics, orders (read-only display).
- No "Apply for API access" banner, no payout creation if role lacks it.

So the access plumbing already exists — we only need the login entry point.

---

## Technical details

### Files edited
- `src/pages/MerchantLoginPage.tsx` — layout shrink, remove PIN toggle (always-masked), add MerchantApplicationFlow sheet, add Owner/Staff segmented toggle, add `handleStaffSignIn`.

### Files added
- _None._ Reuses `merchant_staff` table, `get_staff_merchant_access` RPC, and `useStaffAccess` hook that already exist.

### Edge function change
Extend `supabase/functions/merchant-login/index.ts` to accept `mode: "owner" | "staff"` (default `"owner"` for backward compat):

- **owner mode** — unchanged; requires `merchant` or `admin` role on `user_roles`.
- **staff mode** — same lockout + PIN auth, but instead of checking `user_roles`, runs:
  ```sql
  select merchant_id, business_name, staff_role
  from get_staff_merchant_access(<user_id>)
  where exists (select 1 from merchant_staff where user_id = <user_id> and is_active = true)
  ```
  If empty → return `{ ok:false, message: "Not linked to any merchant store" }` (counts as failed attempt, same as wrong PIN, so brute-force protection still applies).
  If found → device-token gate runs the same way (OTP on new device), session is returned, plus an extra field `staff: { merchant_id, role, business_name }` so the client can show a confirmation toast like "Welcome, Manager of <Business>".

This keeps **all** security guarantees (lockout, device fingerprint, OTP on new device, trust-token reuse) for staff logins without duplicating logic.

### Client-side staff sign-in handler (sketch)
```tsx
const handleStaffSignIn = async (e) => {
  e.preventDefault();
  // … same phone/PIN validation, lockout guard
  const result = await callMerchantLogin(cleanedPhone, pin, {
    device_token: stored ?? undefined,
    mode: "staff",        // NEW
  });
  // same kinds: session / otp_required / locked / wrong_credentials
  // on session → finalizeSession + toast `Welcome, ${result.body.staff.role}`
};
```

### Layout diagram (after)
```text
┌────────────────────────────┐  ← 390 × 638
│  [logo]  MERCHANT PORTAL   │  56 px
│       Welcome back         │  36 px
│                            │
│  ( Owner | Manager )       │  36 px  ← NEW segmented toggle
│  ┌──────────────────────┐  │
│  │ Mobile  +880 1XXXX…  │  │  56 px
│  │ PIN     ● ● ● ●      │  │  72 px  (always masked)
│  │ [ Sign in to dash ]  │  │  44 px
│  └──────────────────────┘  │
│  Apply as a merchant ›     │  20 px  (opens sheet)
│  Customer · Team login     │  18 px
└────────────────────────────┘
                            ≈ 600 px total — fits without scroll
```

### Memory updates
Append a note under `mem://auth/team-access` (or a new short memory) recording that merchant-staff sign-in goes through `merchant-login` with `mode: "staff"` and is gated by `merchant_staff.is_active` + `get_staff_merchant_access` RPC.

---

## Out of scope
- No changes to `/team-login` (EasyPay internal employees only).
- No changes to `MerchantDashboard` — staff role gating already works.
- No new tables, no migration.

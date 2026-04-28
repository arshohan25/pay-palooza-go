## Goal

Polish the Merchant Login screen and add a real Manager (staff) sign-in flow wired to the existing `merchant_staff` table, while preserving the current owner login behavior.

---

## 1. Single-screen layout (no scroll @ 390×638)

Tighten `MerchantLoginPage.tsx` so all content fits in the viewport without scrolling, while keeping every existing element (logo, eyebrow, heading, phone, PIN, sign-in button, trust pills, perks strip, footer links).

Specific reductions:
- Outer wrapper: `py-10` → `py-3`, vertical-center using `min-h-screen` flex.
- Logo tile: `h-16 w-16` → `h-12 w-12`; mb-6 header block → `mb-3`.
- Heading: `text-3xl` → `text-2xl`, `mt-3` → `mt-2`; subtitle `text-sm` → `text-[12px]`, clamp to one line.
- Card padding: `p-6 sm:p-7` → `p-4`.
- PIN slots: `h-12 w-12` → `h-11 w-11`; outer PIN container `p-3` → `p-2`.
- Submit button: `h-12 mt-6` → `h-11 mt-4`.
- Trust pills + perks strip: collapse into a single compact row (3 trust chips on one line, perks row `py-3`→`py-2`, icons `h-4`→`h-3.5`).
- Footer block: `mt-6 gap-3` → `mt-3 gap-2`; smaller text.

This keeps every element on screen at 390×638 without scrolling.

## 2. PIN auto-masks (remove Show/Hide)

- Drop `showPin` state, `Eye`/`EyeOff` imports, and the toggle button next to the "4-DIGIT PIN" label.
- Always render PIN slots as dots: replace the inline `style` mask hack with a clean approach — render `•` as the slot character whenever `pin[i]` is set, by using the `InputOTPSlot` `char` prop pattern (or keep the existing `color: transparent / textShadow` mask but apply unconditionally). Simpler: keep masking CSS always-on so digits never appear.

## 3. "Become a merchant" → button style

Replace the current text link at the bottom with a proper outlined button (same row position):
- Use the existing `<Button variant="outline">` in glass form: `border-white/20 bg-white/[0.06] text-amber-100 hover:bg-white/[0.12]`, `h-10 rounded-2xl`, full-width.
- Label: "New here? Apply as a merchant" with `ArrowRight` icon.
- Click navigates to `/?apply=merchant` (existing flow trigger) — keep current `navigate("/merchant")` if that's how the apply flow opens; will verify and reuse the existing trigger used on AuthPage.

## 4. Replace "Customer login / Staff login" → "Manager Login" (wired to DB)

### UI change
- Remove the two small footer links ("Customer login", "Staff login").
- Add a single "Sign in as Manager" link (subtle text button) under the new "Apply as merchant" button.
- Clicking it flips the form into **Manager mode** (segmented state on the same page — no extra route). A small badge above the form switches between "Merchant Owner" and "Store Manager" so user can toggle back.

### Backend wiring (uses existing schema — no new tables)

`merchant_staff` already has:
- `user_id` (auto-resolved from phone via `resolve_staff_user` trigger),
- `role` ∈ {Manager, Cashier, Viewer}, `is_active`,
- RPC `get_staff_merchant_access(p_user_id)` returning `{ merchant_id, business_name, staff_role }`,
- Hook `useStaffAccess()` and `RoleGuard ... allowStaff` already in use on `/merchant`.

So the manager login simply needs to authenticate a regular user account (phone + 4-digit PIN), then verify the user is linked as **active Manager** in `merchant_staff` before redirecting to `/merchant`.

### Edge function: extend `merchant-login`
Add a new optional input `mode: "owner" | "manager"` (default `"owner"`). All existing behavior (lockout, PIN auth via `${pin}EP`, device-trust OTP gate, session minting) stays identical. Only the **role gate** at step 3 changes:

```ts
if (mode === "manager") {
  const { data: staff } = await admin.rpc("get_staff_merchant_access", { p_user_id: user.id });
  const row = Array.isArray(staff) ? staff[0] : null;
  if (!row || row.staff_role !== "Manager") {
    return json(403, { ok: false, message: "This account isn't an active store manager" });
  }
} else {
  // existing merchant/admin role check unchanged
}
```

Why "Manager" only (not Cashier/Viewer): the request explicitly says "merchant manager login". Cashier/Viewer remain managed via the existing owner-added staff workflow without a dedicated login entry.

The session minted is for the staff user themselves; on `/merchant`, `useStaffAccess` already detects them, `RoleGuard allowStaff` admits them, and `MerchantDashboard` already filters `staffAllowedTabs` based on role and shows a staff banner. No changes needed there.

### Client wiring
`MerchantLoginPage.tsx` passes `mode: loginMode` in the `merchant-login` invoke body inside `callMerchantLogin`. Device-trust token storage key stays per-phone+portal so manager and owner accounts on the same device coexist.

### No DB migration required
All needed table columns, trigger, RLS policy, and RPC already exist. We only edit the edge function and the page.

---

## Files to edit

- `src/pages/MerchantLoginPage.tsx` — compact layout, remove PIN show/hide, add Owner/Manager toggle, replace footer links with apply-button + manager link, pass `mode` to edge function.
- `supabase/functions/merchant-login/index.ts` — accept `mode`, branch role gate to `get_staff_merchant_access` for manager mode.

## Out of scope (not changed)

- `MerchantDashboard.tsx`, `RoleGuard.tsx`, `useStaffAccess` — already correctly handle staff sessions.
- `merchant_staff` schema, RPC, RLS — already complete.
- `TeamLoginPage.tsx` — remains for internal team (admin/compliance/etc.).

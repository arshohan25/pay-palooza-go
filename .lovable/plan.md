
## Remove Step Indicator Pills & Elevate All Flow UIs to Ultra-Premium

### What the User Wants
The screenshot shows the numbered step breadcrumb pills (1 Recipient — 2 Amount — 3 Confirm — 4 PIN) rendered inside the colored header of every flow screen. The user wants these completely removed. They also want the overall UI made "ultra premium."

---

### Files to Change

All 7 flow components share the same structural pattern — a colored gradient header with a back button, a title, and a row of step pills below the title. The step pills block will be deleted from every file. After removal, the header becomes more minimal and elegant. We will then enhance both the header and the body of each screen to match an ultra-premium aesthetic.

The files are:
1. `src/components/SendMoneyFlow.tsx`
2. `src/components/CashOutFlow.tsx`
3. `src/components/PaymentFlow.tsx`
4. `src/components/MobileRechargeFlow.tsx`
5. `src/components/PayBillFlow.tsx`
6. `src/components/AddMoneyFlow.tsx`
7. `src/components/ChangePinFlow.tsx`

KYC (`KycFlow.tsx`) also has step pills — we will remove those too for consistency.

---

### Step 1 — Remove the Step Pill Rows

In every file, delete the `<div className="flex gap-2 items-center ...">` block that renders `STEPS.map(...)` or `PROGRESS_STEPS.map(...)`. Also remove the now-unused `CheckCircle2` import from the icon list in each file (unless it's used elsewhere in the same file — it is still used in the success screen of SendMoneyFlow and in KycFlow body, so we keep those imports).

---

### Step 2 — Upgrade the Header Section (Ultra-Premium)

Replace the current plain-text title in the header with a richer, more spacious design:

- **Increase top padding**: `pt-12` → `pt-14` for more breathing room under the status bar.
- **Reduce bottom padding**: `pb-6` → `pb-8` to give the header more vertical height now that the pills are gone.
- **Back button**: Upgrade from a plain `w-8 h-8` circle to a larger `w-10 h-10` frosted-glass circle with a subtle ring: `bg-white/20 ring-1 ring-white/30 backdrop-blur-sm`.
- **Title**: Increase to `text-xl font-extrabold tracking-tight` with a subtitle line showing context (e.g., "Secure & Instant Transfer" for Send Money).
- **Amount display in header** (Amount/PIN steps only): Show the entered amount as a large display in the header — e.g., a `text-4xl font-black` balance figure that replaces the step pills visually.
- **Progress bar**: Replace the pill stepper with a sleek slim progress bar — a single `h-1 rounded-full bg-white/20` track with a `bg-white rounded-full` filled segment that animates width proportionally to the current step. This is subtle, non-distracting, and gives spatial orientation without clutter.

---

### Step 3 — Remove In-Display Keyboards in Remaining Flows

`CashOutFlow` and `PaymentFlow` still have a custom `PinPad` component (12-key on-screen numpad). Replace those with the same native-input + animated dot indicator pattern already used in `SendMoneyFlow` (hidden `type="password" inputMode="numeric"` input + 4 dot indicators). Remove the `Delete` import and `PIN_KEYS` array from these files.

---

### Step 4 — Ultra-Premium Card & Content Styling

Across all flow content panes:

- **Amount input**: Change the amount input container to have a subtle gradient border (`ring-2 ring-primary/20`) when focused, a larger height (`h-20`), and a lightly frosted background in dark mode.
- **Summary/fee cards**: Give `.rounded-2xl bg-muted/50` cards a `border border-border/60 shadow-card` and `backdrop-blur-sm` feel.
- **Contact/agent/merchant list items**: Add `hover:border-primary/30` and a micro-animation `whileHover={{ x: 2 }}` with framer-motion for a refined feel.
- **CTA buttons**: Make all flow action buttons `h-14` (taller) with `text-base font-bold tracking-wide rounded-2xl` and a subtle `shadow-glow` when the gradient matches primary.
- **Quick-amount chips**: Use `rounded-xl` pill style with a slightly larger font and an animated border when selected.
- **Sticky footer on packs screen** (MobileRecharge): Add `backdrop-blur-lg` to the bottom sheet.

---

### Step 5 — Success Screens

The success screens already look strong. Minor polish:
- Add a soft radial glow behind the icon.
- Ensure the success card uses `shadow-glow-lg`.

---

### Technical Details

| Component | Step pills location | Lines (approx.) |
|---|---|---|
| SendMoneyFlow | `PROGRESS_STEPS.map(...)` block | lines 259–276 |
| CashOutFlow | `STEPS.map(...)` block | lines 239–259 |
| PaymentFlow | `STEPS.map(...)` block | lines 198–215 |
| MobileRechargeFlow | `STEPS.map(...)` block | lines 381–395 |
| PayBillFlow | `STEPS.map(...)` block | lines 272–290 |
| AddMoneyFlow | `STEPS.map(...)` block | lines 196–208 |
| ChangePinFlow | `STEPS.map(...)` block | lines 226–245 |
| KycFlow | `STEPS.map(...)` block | lines 401–420 |

After deleting the pills, the header shrinks. We compensate with the slim animated progress bar and the richer title + subtitle layout, creating a more intentional, luxury feel — like premium fintech apps (Revolut, Wise, N26).

The `STEP_LABELS`, `STEPS`, and `STEP_LABELS` constants are still needed for the progress bar calculation, so they are kept. Only the JSX render block of the pills is removed.

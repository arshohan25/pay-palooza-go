## Goal

Tighten the returning-user state on `/merchant-login` (and the manager login that mirrors it):

1. Make the masked phone chip self-explanatory — users should immediately understand `+880 19••••••954` is their real number with the middle digits hidden.
2. Make **Forgot PIN?** unmistakable (it exists today but reads as a tiny inline link).
3. Remove the noisy trust pills (Secure PIN / Encrypted / Bank-grade) and perks strip (Orders / Payouts / QR / Insights) for returning users — the chip already establishes trust, and the perks belong on the apply-as-merchant landing, not the sign-in screen.

The first-time (no `boundPhone`) state keeps the trust + perks rows since they're still useful for new visitors.

## Changes

### 1. `src/pages/MerchantLoginPage.tsx`

**Masked chip (lines ~539–570)** — add a subtle helper line + a small "Hidden for privacy" hint inside the chip:

```text
SIGNED IN AS
┌──────────────────────────────────────┐
│ 📞  +880 19••••••954            [×]  │
│     Middle digits hidden for privacy │
└──────────────────────────────────────┘
Not you? Tap × to use a different number.
```

- Replace the current "THIS DEVICE" sub-label with `Middle digits hidden for privacy` so the format is self-documenting.
- Add a one-line caption directly under the chip: `Not you? Tap × to use a different number.` (text-[11px], white/50).

**Forgot PIN button (lines ~593–606)** — promote from a thin text link to a pill button placed under the PIN grid (full width on the right side of the row stays, but styling becomes a clear glass pill with amber accent):

- Replace the current `<button>` with a `rounded-full border-amber-200/40 bg-amber-300/10 px-3 py-1` chip containing `HelpCircle` + "Forgot PIN?" so it visually reads as an action, not a footnote.
- Add a second, larger fallback link **below** the Sign-in button when `boundPhone` is set: `Can't remember your PIN? Get help →` (text-[12px], amber-100/80, opens the same `MerchantForgotPinSheet`). This is the prominent "where is forgot button" answer.

**Trust pills + perks strip (lines ~653–684)** — wrap both blocks in `{!boundPhone && (...)}` so they only render for first-time visitors. Returning users see a clean form: chip → PIN → Sign in → Forgot help link → Apply / Manager footer.

### 2. `src/pages/MerchantManagerLoginPage.tsx`

Mirror the same three edits with the existing sky/blue accent palette (instead of amber) so the manager screen stays consistent.

### 3. No backend / schema / edge function changes

The `merchant-forgot-pin` edge function and `merchant_pin_reset_requests` table are already wired; this is UI-only.

## Out of scope

- No change to the unmasked input flow (first-time entry stays identical).
- No change to mask format itself (`019••••••954` was already approved).
- No change to `MerchantForgotPinSheet` internals.

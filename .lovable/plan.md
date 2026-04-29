## Goals

1. On a verified/bound device, declutter the merchant + manager login screens by removing the redundant explanatory copy and secondary help button.
2. Move the **Forgot PIN / Reset PIN** action out of the form area and place it as a premium, full-width pill **above** the existing footer buttons ("New here? Apply as a merchant" on owner login, "Are you the store owner? Owner login" on manager login), so it sits in front of the arrow-style footer actions.

## Changes

### 1. Owner login — `src/pages/MerchantLoginPage.tsx`

Inside the masked-phone chip block (currently shows `+88 019•••••954`):
- **Remove** the sub-label `"Middle digits hidden for privacy"` (line ~550-552).
- **Remove** the paragraph `"This device is locked to this merchant account. To use a different number, clear app data..."` (line ~562-564).
- Keep the `Lock` icon badge on the right of the chip — it already signals the lock visually. Optionally add `aria-label="Locked to this merchant account"` for screen readers (already present).

Inside the PIN section header (line ~593-600):
- **Remove** the small "Forgot PIN?" pill button next to the "4-DIGIT PIN" label so the label sits clean on its own row.

Below the "Sign in to dashboard" submit button:
- **Remove** the existing `{boundPhone && (...)}` "Can't remember your PIN? Get help →" secondary button (lines ~648-659).

### 2. Manager login — `src/pages/MerchantManagerLoginPage.tsx`

Inside the PIN section header (line ~458-470):
- **Remove** the small "Forgot PIN?" pill button next to the "Your 4-digit PIN" label.

### 3. New premium Forgot PIN button in footer — both pages

Add a new full-width pill **above** the existing footer "New here? Apply as a merchant" / "Owner login" buttons (i.e. as the first item inside the `<div className="mt-3 flex flex-col items-center gap-2 text-center">` footer block).

**Design — premium glass pill, brand-accent gradient ring, shimmer hover:**

```tsx
<button
  type="button"
  onClick={() => setForgotOpen(true)}
  className="group relative h-11 w-full overflow-hidden rounded-2xl border border-amber-200/40 bg-gradient-to-r from-amber-300/[0.08] via-orange-300/[0.10] to-rose-300/[0.08] px-4 text-sm font-semibold text-amber-50 shadow-[0_8px_24px_-12px_rgba(251,146,60,0.55)] backdrop-blur-xl transition-all hover:border-amber-200/60 hover:from-amber-300/[0.18] hover:via-orange-300/[0.22] hover:to-rose-300/[0.18] hover:shadow-[0_12px_32px_-12px_rgba(244,63,94,0.6)]"
>
  <span
    aria-hidden
    className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-opacity group-hover:animate-[shimmer_1.4s_ease-out] group-hover:opacity-100"
  />
  <span className="relative z-10 inline-flex items-center justify-center gap-2">
    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-amber-200/40 bg-amber-300/15">
      <KeyRound className="h-3.5 w-3.5 text-amber-200" />
    </span>
    Forgot PIN? Reset securely
    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
  </span>
</button>
```

For manager login, swap `amber/orange/rose` palette for `sky/indigo/violet` to match the page's blue accent and use `text-sky-50` / `border-sky-200/40` etc.

Add `KeyRound` to the `lucide-react` imports on both pages (or reuse `HelpCircle` if `KeyRound` causes friction — `KeyRound` reads more "premium / reset PIN").

If the shimmer keyframe isn't already in `tailwind.config.ts`, add:
```ts
keyframes: {
  shimmer: { '0%': { transform: 'translateX(-30%) skewX(-12deg)' }, '100%': { transform: 'translateX(400%) skewX(-12deg)' } },
}
```
(Check `tailwind.config.ts` first — many projects already have a `shimmer` keyframe; if so, skip.)

### 4. Behaviour preserved

- The Forgot PIN sheet (`MerchantForgotPinSheet`) wiring is unchanged — same `setForgotOpen(true)` handler, same `defaultPhone` prop.
- The `boundPhone` lock behaviour, masked phone format (`+88 019•••••954`) and `Lock` icon badge stay intact.
- On the owner page the new button shows for **both** first-time and returning users (it replaces both the in-form pill and the conditional secondary button).

### Files touched

- `src/pages/MerchantLoginPage.tsx` — strip redundant copy from masked chip, remove in-form Forgot PIN pill, remove secondary help button, add premium Forgot PIN pill at top of footer stack.
- `src/pages/MerchantManagerLoginPage.tsx` — remove in-form Forgot PIN pill, add premium Forgot PIN pill (sky variant) at top of footer stack.
- `tailwind.config.ts` — add `shimmer` keyframe + animation only if not already defined.

No DB / edge-function changes.

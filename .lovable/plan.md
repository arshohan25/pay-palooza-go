# Merchant Login Page

A dedicated, premium-feel sign-in page for merchants at `/merchant-login`, separate from the customer `AuthPage` and the staff `TeamLoginPage`.

## What you'll get

- A new route `/merchant-login` with a glassmorphism, brand-aligned login experience.
- Phone (11-digit BD) + 4-digit PIN authentication, reusing the existing `signIn(phone, pin)` helper.
- Role gate: only accounts with the `merchant` role (or admin) are allowed in. Other roles are signed out and shown a clear message with a link back to the right portal.
- "Apply to become a merchant" CTA linking to the existing merchant application flow for users who don't yet have a merchant account.
- Returning-user convenience: if a phone is already bound on this device (`mfs_device_phone`), prefill it.
- Forgot PIN link routes to the existing customer auth recovery path.

## Visual design (premium, eye-catching)

Aligned with the project's glassmorphism identity (19px radii, dark gradient surfaces, hidden scrollbars):

- Full-bleed dark gradient background (`from-slate-950 via-indigo-950 to-emerald-950`) with two soft blurred bokeh blobs (emerald + indigo) for organic depth.
- Centered glass card (`backdrop-blur-2xl`, white/5 surface, white/10 border, 19px rounded, large soft shadow) with staggered fade-in entrance.
- Header block: EasyPay logo, a "Merchant Portal" eyebrow chip, title "Welcome back", subtitle "Sign in to manage your store, orders, and payouts".
- Phone field with leading `+880` chip and `Phone` icon; PIN field as 4-slot `InputOTP` with show/hide toggle.
- Primary CTA: gradient emerald→teal button, full width, with loading spinner and subtle hover scale.
- Trust row under the form: three small glass pills — "Secure PIN", "Encrypted", "RBI-grade safety" — each with a lucide icon.
- Footer links: "New here? Apply as a merchant" (→ `/merchant`/apply flow) and "Customer login" (→ `/auth`).
- Subtle marquee/feature strip at the bottom of the card listing merchant perks (Orders, Payouts, QR, Analytics) using small icons.

## Behaviour

1. User enters phone + PIN and taps Sign in.
2. Call `signIn(phone, pin)` from `src/lib/auth.ts`.
3. On success, fetch `user_roles` for the new session:
   - If roles include `merchant` or `admin` → `navigate("/merchant", { replace: true })`.
   - Otherwise → `supabase.auth.signOut()`, toast "This account isn't a merchant account" and offer link to `/auth` or merchant application.
4. On failure, toast the error from Supabase (invalid credentials, etc.).
5. Persist the phone to `localStorage.mfs_device_phone` after a successful merchant login (matches existing returning-user pattern).

## Files

- New: `src/pages/MerchantLoginPage.tsx` — the page component.
- Edit: `src/App.tsx` — add `<Route path="/merchant-login" element={<MerchantLoginPage />} />` (public, no guard) and lazy import.
- Optional small edit: link "Merchant login" entry from `RoleInstallPage` / merchant install manifest landing if it currently points to `/auth` (will only touch if a clean spot exists).

## Out of scope

- No new auth method, no new tables, no edge functions.
- No changes to existing `AuthPage` or `TeamLoginPage`.
- No PIN reset flow rebuild — link to existing flow.

## Technical notes

- Reuse `signIn`, `phoneToEmail`-adjacent helpers from `src/lib/auth.ts`; do not duplicate auth logic.
- Use `supabase.from("user_roles").select("role").eq("user_id", user.id)` for the gate (same pattern as `TeamLoginPage`).
- Use existing UI primitives: `Card`, `Input`, `Button`, `InputOTP`, `Label`, `sonner` toast, `lucide-react` icons.
- Animation via existing Tailwind keyframes (`animate-fade-in`, `animate-scale-in`) and `hover-scale` utility — no new deps.
- Respect the icon constraint: use `Store`, `ShieldCheck`, `Lock`, `Phone`, `Sparkles` — never `PiggyBank`.

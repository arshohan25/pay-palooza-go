## Issues observed (from screenshot at /account in merchant PIN reset flow)

1. **Full phone visible in composer.** The prefilled draft contains `+88 019•••••954` text — but `redactSensitive` runs only on the rendered context body, not on the input text. Worse, on submit the actual sent message will contain the masked form fine, BUT the screenshot shows `+88 019•••••954` already masked in composer ✓. The real leak is **the context banner body** still shows the full masked phone — actually that's masked too. Re-reading: the red box highlights the composer text containing `+88 019•••••954`. That IS masked. The user's complaint is that this masked-but-still-identifiable number plus the dotted middle is undesirable, AND `redactSensitive` would normally turn `01XXXXXXXXX` into `[PHONE REDACTED]` — but the masked form (`019•••••954`) bypasses the regex.

   **Real fix:** In `MerchantForgotPinSheet.goToLiveSupport()`, do not embed the phone (masked or otherwise) into either the prefill draft or the context body. Reference it generically ("my registered number") and rely on the OTP ticket / server-side log for identification.

2. **Live Chat sheet not responsive on 390px viewport.** In `AccountPage.tsx` (lines 523–538), the `<SheetContent>` uses `h-[85vh]` with `<SupportChat>` inside — but `SupportChat` itself sets `h-[50vh]` on its root, so it doesn't fill the sheet, and the messages area gets squeezed. On small phones the bubbles overlap the avatars and the composer is cramped.

   **Fix:**
   - Change `SupportChat` root from `h-[50vh]` to `h-full min-h-0`.
   - Add `flex flex-col min-h-0` chain so the messages list scrolls independently.
   - Reduce horizontal padding (`px-4` → `px-3`) and tighten message bubble max-width on `<sm` so avatars don't get clipped.
   - Make the AccountPage sheet use `h-[92dvh] sm:h-[85vh]` with `dvh` for mobile browser chrome.

3. **Merchant PIN reset chat opens user app (`/account`) instead of merchant app.** `MerchantForgotPinSheet.goToLiveSupport()` always navigates to `/account?openChat=1...`, but this sheet is launched from `/merchant-login` and `/merchant-manager-login`. After login the user lands in `/merchant`, which doesn't even have an `openChat` handler.

   **Fix:**
   - Add an `openChat` query handler on the merchant side. Two options:
     - **(a) New route `/merchant-support`** — a lightweight standalone page that renders `<SupportChat>` in a full-screen sheet, gated by auth, branded with the merchant theme. Works even if the user isn't yet logged into merchant portal (since PIN reset is pre-login).
     - **(b) Reuse `/account` but theme it.** Less work but mixes user + merchant surfaces.
   - Recommend **(a)**: PIN reset is pre-login, so we cannot rely on the merchant dashboard's auth guard. The new `/merchant-support` page will:
     - Require a valid Supabase session (sign in is independent of merchant PIN — the OTP step just verified phone ownership; if no session exists, prompt them to sign in to the EasyPay account first, OR allow anonymous handoff via the existing `merchant-forgot-pin` edge function ticket which already logged the request server-side).
     - Read `prefill`, `contextTitle`, `contextBody` query params identically to `AccountPage`.
     - Render `<SupportChat>` filling the viewport.
   - Update `MerchantForgotPinSheet.goToLiveSupport()` to navigate to `/merchant-support?...` instead of `/account?...`.

## Files to change

- `src/components/merchant/MerchantForgotPinSheet.tsx`
  - Remove phone from `prefill` and `contextBody` (use generic phrasing + reference the OTP ticket id if available).
  - Change navigation target from `/account` to `/merchant-support`.

- `src/components/SupportChat.tsx`
  - Root: `h-[50vh]` → `h-full min-h-0 flex flex-col`.
  - Tighten bubble `max-w-[75%]` → `max-w-[78%] sm:max-w-[75%]`, add `break-words` (already present), and shrink avatar spacing on small screens.

- `src/pages/AccountPage.tsx`
  - Sheet height: `h-[85vh]` → `h-[92dvh] sm:h-[85vh]`, ensure inner wrapper is `flex flex-col min-h-0`.

- `src/pages/MerchantSupportPage.tsx` (new)
  - Mirrors AccountPage's `openChat` query parsing.
  - Full-screen merchant-themed shell (dark gradient matching `MerchantForgotPinSheet`).
  - Renders `<SupportChat userId={...} initialDraft={...} initialContext={...} />`.
  - If no session: show a CTA explaining the verified ticket has been logged and to sign in to continue chat.

- `src/App.tsx`
  - Register `/merchant-support` route (public — no `RoleGuard`, so pre-login users from PIN reset flow can land here).

## Acceptance

- Submitting the PIN reset chat from `/merchant-login` lands on `/merchant-support`, not `/account`.
- The composer prefill no longer contains the phone digits (masked or otherwise). Context banner shows only "Source: merchant-login · Verified at <timestamp>".
- At 390×638, the Live Chat sheet fills the viewport, messages scroll independently, no avatar/bubble overlap, composer fully visible above the keyboard.

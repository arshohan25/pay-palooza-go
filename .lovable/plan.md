

## Fix Payment URL Issues

After reviewing the payment URL `/pay?merchant=MRC-RAFIQ-001&ref=KXNCNESY&amount=100`, I found several bugs:

### Issues Found

1. **`ref` parameter is ignored** — The URL contains `ref=KXNCNESY` but PayPage never reads it or passes it anywhere.

2. **Amount not pre-filled in manual pay** — When choosing "Pay Manually", only `merchantCode` is passed to `PaymentFlow`. The `amount` from the URL is lost — the user has to re-enter it manually.

3. **Login redirect doesn't work** — The "Log In to Pay" button navigates to `/?redirect=/pay?merchant=...` but the Index/Auth page never reads the `redirect` param, so after login users land on the home page instead of returning to the payment link.

4. **Note not passed to PaymentFlow** — The `note` query param is displayed on the choice screen but not forwarded into the payment flow.

### Plan

**File 1: `src/components/PaymentFlow.tsx`**
- Add `prefilledAmount` and `prefilledNote` optional props to `PaymentFlowProps`
- When `prefilledAmount` is provided alongside a valid prefilled merchant, auto-set the amount and skip to the PIN step
- When `prefilledNote` is provided, auto-set the note field

**File 2: `src/pages/PayPage.tsx`**
- Read the `ref` search param and display it on the summary screens
- Pass `amount` and `note` to `PaymentFlow` as `prefilledAmount` and `prefilledNote`
- Fix the login redirect: change the "Log In to Pay" button to navigate to `/auth?redirect=...` (or whichever route handles login) so users return to the pay page after authentication

**File 3: `src/pages/AuthPage.tsx` or `src/pages/Index.tsx`**
- Handle the `redirect` query parameter after successful login — navigate to the redirect URL instead of the default home page

### Technical Notes
- `PaymentFlow` already has the `prefilledMerchantId` pattern; `prefilledAmount` will follow the same approach in the existing `useEffect` that resolves the merchant
- The redirect flow will use `navigate()` after detecting a successful auth state change
- The `ref` param will be shown as a reference/order ID on the payment summary for user context


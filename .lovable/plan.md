# Register `/account` route

## Problem
`MerchantApiAccessGate` and `MerchantApiAccessStatusBanner` navigate to `/account?...` (with `openChat`, `prefill`, `contextTitle`, `contextBody`, `merchantId` params) to drop the merchant into the support chat with prefilled context. That URL currently 404s because `AccountPage` is only mounted as a tab inside `Index`, not as its own route.

## Change
Single file: `src/App.tsx`

1. Add a lazy import next to the other page imports:
   ```ts
   const AccountPage = lazy(() => import("./pages/AccountPage"));
   ```
2. Register the route inside the existing `AppLayout` group (so it gets the same chrome as `/shop`, `/orders`, etc.), right after `giftcards`:
   ```tsx
   <Route path="account" element={<AccountPage />} />
   ```

`AccountPage` already reads `useLocation().search` to handle `openChat`, `prefill`, `contextTitle`, `contextBody`, and `merchantId`, so no page-level changes are needed — once the route exists, the deep links from the API gate work end-to-end.

## Out of scope
- No changes to `AccountPage`, the gate, the banner, or `SupportChat`.
- No auth guard added (AccountPage handles unauthenticated state internally, consistent with how it renders today as a tab on `/`).

Approve to apply.
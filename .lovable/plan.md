
Goal: make Dynamic QR links consistently work (preview + published) and prevent false “Invalid Session” states.

What I found
1) The session itself is valid and readable:
- `merchant_payment_sessions` row exists (`a8e96242-...`), status `pending`.
- RLS is already open for read (`Anyone can read payment sessions`), so DB access is not the blocker.
2) Current preview runtime works:
- Opening `/pay/qr/a8e96242-...` in the active preview loaded the QR page and fetched the session successfully (HTTP 200).
3) Published URL currently fails route-level:
- `https://pay-palooza-go.lovable.app/pay/qr/...` returns app `404` (route not in live build yet), which explains production breakage.
4) Link-generation risk in backend API:
- `merchant-payment-api` builds `qr_page_url` from `SITE_URL` or a fallback derived from backend URL. That fallback can produce wrong/unstable app links.

Implementation plan
1) Stabilize URL generation in backend function (primary fix)
- File: `supabase/functions/merchant-payment-api/index.ts`
- Build `baseUrl` using:
  - request `origin` / `referer` host when available (best for dashboard-triggered calls),
  - then configured site URL,
  - only then a safe final fallback.
- Return normalized `checkout_url` and `qr_page_url` from that base.
- Result: generated links point to the actual app host users are on.

2) Use backend-returned URL in merchant dashboard
- File: `src/pages/MerchantDashboard.tsx`
- In `handleTestDynamicQR`, open `data.qr_page_url` first (instead of always `window.open('/pay/qr/...')`).
- Keep local-path fallback only if backend URL is missing.
- Result: no host mismatch between where session is created and where it is opened.

3) Harden Dynamic QR page error states (defensive)
- File: `src/pages/DynamicQrPage.tsx`
- Keep `.maybeSingle()` and add explicit invalid UUID guard.
- Distinguish:
  - not found,
  - expired,
  - fetch error.
- Optional: “Try again” action that re-fetches once.
- Result: fewer generic “Invalid Session” false alarms and clearer diagnosis.

4) Publish parity step (required for production)
- Ensure latest routes (including `/pay/qr/:sessionId`) are in published build.
- This is necessary because current live URL returns 404 despite route existing in source.
- Result: published links become routable.

5) Verification checklist (end-to-end)
- Create fresh session from Merchant Dashboard “Test QR”.
- Verify on preview: QR page loads, timer runs, no invalid-session message.
- Verify on published: same behavior (no 404).
- Verify logged-in and logged-out tabs.
- Verify API response `qr_page_url` opens correct host.

Technical details
- No database migration required right now (RLS policy for read is already correct).
- Primary code changes are in:
  - `supabase/functions/merchant-payment-api/index.ts`
  - `src/pages/MerchantDashboard.tsx`
  - `src/pages/DynamicQrPage.tsx`
- Root issue is environment/link routing consistency, not missing table permissions.

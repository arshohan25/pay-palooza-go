

## Fix: Dynamic QR scanned from user wallet not working

### Problem Analysis
When a user scans a dynamic payment QR from the home page (user wallet), two scenarios can fail:

1. **URL-based QR**: If the QR contains a URL like `https://.../pay/qr/{sessionId}` or `https://.../checkout/{sessionId}` (e.g. from the merchant's `qr_page_url`), `parseQrData` doesn't recognize it and falls through to `flow: "unknown"`. The RPC fallback also fails, showing "Unrecognized QR code."

2. **Direct navigation**: If the user's phone camera (not the in-app scanner) scans the QR, Chrome opens the `/pay/qr/{sessionId}` page — which only shows a QR to scan but has no "Pay Now" button for authenticated users.

### Fix

**1. Update `src/lib/qrParser.ts`** — Add URL pattern matching for EasyPay payment URLs

In the URL parsing section (step 5), detect paths like `/pay/qr/{uuid}` and `/checkout/{uuid}` and extract the session ID to return `flow: "dynamic_payment"`:

```typescript
// Inside the URL try block, before existing query param checks:
const pathMatch = url.pathname.match(/\/(?:pay\/qr|checkout)\/([0-9a-f-]{36})/i);
if (pathMatch) {
  return { flow: "dynamic_payment", identifier: "", sessionId: pathMatch[1] };
}
```

**2. Update `src/pages/DynamicQrPage.tsx`** — Add "Pay Now" button for authenticated users

When the user is logged in and the session is pending, show a "Pay Now" button below the QR code that opens the `DynamicQrPaySheet` (or navigates to `/checkout/{sessionId}`). This handles the case where the user lands on the QR page directly via their phone camera.

- Check auth state with `supabase.auth.getUser()`
- If authenticated, show a "Pay with EasyPay" button
- On click, render the `DynamicQrPaySheet` inline or redirect to `/checkout/{sessionId}`

### Files Changed

| File | Change |
|------|--------|
| `src/lib/qrParser.ts` | Recognize `/pay/qr/{uuid}` and `/checkout/{uuid}` URLs as `dynamic_payment` flow |
| `src/pages/DynamicQrPage.tsx` | Add "Pay Now" button for authenticated users viewing the QR page |


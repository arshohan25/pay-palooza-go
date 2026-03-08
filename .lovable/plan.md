

## Plan: Dynamic QR Payment System (UPI-style)

### Concept

Merchants create a payment session via the existing API. Instead of (or in addition to) redirecting customers to a checkout URL, they display a **dynamic QR code** on their website. The customer scans this QR with the EasyPay app, completes payment in-app, and the merchant page auto-updates via real-time polling.

### Flow

```text
Merchant Website                    EasyPay App
─────────────────                   ───────────
1. POST /merchant-payment-api       
   → gets session_id + qr_data      
2. Displays QR code on page         
   (polls status in real-time)      
                                    3. Customer scans QR
                                       → QR parser routes to payment
                                       → Pre-fills amount + merchant
                                    4. Customer enters PIN → pays
                                       (transfer_money RPC)
5. Real-time update: "PAID" ✓       
   → redirect to success_url        
   → webhook fires to callback_url  
```

### Changes

**1. Extend `merchant-payment-api` edge function** — Add `qr_data` to the `create_session` response. The QR payload is a JSON string: `{"type":"easypay","sessionId":"...","merchantId":"...","amount":250,"ref":"ORDER-123"}`.

**2. Create embeddable QR page: `src/pages/DynamicQrPage.tsx`** — A new route `/pay/qr/:sessionId` that:
- Fetches the session from `merchant_payment_sessions`
- Renders a large QR code (using existing `qrcode` package) with merchant name, amount, countdown timer
- Polls session status every 3 seconds via Supabase realtime subscription
- Shows animated "Payment Received" state when status changes to `completed`
- Redirects to `success_url` after a brief delay

**3. Update QR parser (`src/lib/qrParser.ts`)** — Add detection for the new `{"type":"easypay","sessionId":...}` JSON format. Return a new flow type `"dynamic_payment"` with the session ID.

**4. Update QR Scanner Modal (`src/components/QrScannerModal.tsx`)** — When `flow === "dynamic_payment"`, open a new in-app payment sheet that:
- Fetches session details (amount, merchant name)
- Shows amount (read-only, set by merchant)
- PIN verification step
- Calls `checkout-pay` or `transfer_money` to complete payment

**5. Create `src/components/DynamicQrPaySheet.tsx`** — Bottom sheet for in-app QR payment:
- Displays merchant name, amount, reference
- PIN entry → calls existing checkout-pay edge function
- Success animation with confetti

**6. Merchant SDK enhancement (`public/sdk/easypay-sdk.js`)** — Add a `displayQR(containerId, sessionId)` method that merchants can embed on their checkout page, rendering the QR + real-time status listener.

**7. Route addition in `App.tsx`** — Add `/pay/qr/:sessionId` route.

### Database

No new tables needed. The existing `merchant_payment_sessions` table already stores everything. The QR is generated dynamically from session data.

### Files

| File | Action |
|------|--------|
| `supabase/functions/merchant-payment-api/index.ts` | Add `qr_data` to create_session response |
| `src/lib/qrParser.ts` | Add `dynamic_payment` flow detection |
| `src/pages/DynamicQrPage.tsx` | New — embeddable QR display page |
| `src/components/DynamicQrPaySheet.tsx` | New — in-app payment sheet for scanned QR |
| `src/components/QrScannerModal.tsx` | Handle `dynamic_payment` flow |
| `src/App.tsx` | Add `/pay/qr/:sessionId` route |
| `public/sdk/easypay-sdk.js` | Add `displayQR()` method |




## Plan: Add Dynamic QR Demo & SDK Integration Example

The Dynamic QR payment system is already fully implemented (QR page, parser, pay sheet, API, SDK). Two things remain:

### 1. Dynamic QR Demo on Merchant Dashboard

**File: `src/pages/MerchantDashboard.tsx`**

Add a "Test Dynamic QR" button to the **MerchOverview** quick actions grid (line ~618). When tapped, it:
- Calls the `merchant-payment-api` edge function with `action: "create_session"` using the merchant's own API key
- Opens the resulting `/pay/qr/:sessionId` page in a new tab (or shows it in a modal)
- Lets the merchant see exactly what their customers would see

This will be added as a 5th quick action or as a prominent card below the existing quick actions.

### 2. SDK Integration Example Page/Section

**File: `src/components/MerchantApiTab.tsx`**

Add a "Dynamic QR Integration" section to the existing API tab showing:
- A code snippet demonstrating `EasyPay.displayQR()` usage
- A complete HTML example merchants can copy-paste
- Explains the flow: create session -> display QR -> listen for completion

### Files to Change

| File | Change |
|------|--------|
| `src/pages/MerchantDashboard.tsx` | Add "Test Dynamic QR" demo flow to MerchOverview |
| `src/components/MerchantApiTab.tsx` | Add Dynamic QR SDK integration docs section |


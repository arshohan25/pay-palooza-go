

## Fix: "Merchant profile not found" in Dynamic QR Payment

### Root Cause
The `DynamicQrPaySheet.tsx` payment flow (line 97) queries the **merchant's** profile to get their phone number:
```tsx
const { data: merchantProfile } = await supabase.from("profiles").select("phone").eq("user_id", merchant.user_id).single();
```

But the RLS policy on `profiles` only allows users to read **their own** row (`auth.uid() = user_id`). So when a payer (different user) tries to look up the merchant's profile, it returns `null` → "Merchant profile not found".

### Solution
Move the payment logic to the **`checkout-pay` edge function** (server-side, service-role client) which already handles this correctly and bypasses RLS. The client-side `DynamicQrPaySheet` should call this edge function instead of doing direct DB queries.

Alternatively, add a minimal RLS policy allowing authenticated users to read only the `phone` column of other profiles — but this is less secure.

**Recommended approach**: Refactor `DynamicQrPaySheet.tsx` to call the `checkout-pay` edge function.

### Changes

**1. `src/components/DynamicQrPaySheet.tsx`**
- Replace the direct Supabase queries (lines 78-130) with a single call to the `checkout-pay` edge function
- Send `sessionId`, `pin`, and payer info to the edge function
- The edge function already uses a service-role client that can read any profile

**2. `supabase/functions/checkout-pay/index.ts`**
- Add support for a `source: "qr"` parameter so the edge function knows it's a QR-based payment
- Ensure it handles the same transfer logic currently in the client component

This keeps all sensitive cross-user queries server-side where RLS doesn't block them.


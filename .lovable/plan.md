

## Fix: Payment "Recipient not found" Error

### Root Cause Analysis

Two issues identified:

1. **Primary**: The `/pay` page calls `resolve_transfer_recipient` RPC which requires `auth.uid()` — it throws "Not authenticated" if the user isn't logged in. This means guest checkout only works if the user happens to already be logged in to EasyPay. When not logged in, the merchant can't be resolved and the page shows "not_found".

2. **Secondary**: In `checkout-guest` edge function, the recipient profile lookup uses `.single()` which throws on zero results instead of returning null cleanly. While this works, it conflates "not found" with potential multi-row errors.

### Changes

**1. Database migration — Create a public merchant resolver function**

Create a `SECURITY DEFINER` RPC `resolve_payment_merchant(p_identifier text)` that does NOT require `auth.uid()`. It only resolves merchants (not send/cashout flows), returning `found`, `recipient_phone`, `recipient_name`, and basic merchant info. This is safe because merchant payment pages are inherently public-facing.

**2. `src/pages/PayPage.tsx` — Use the new public RPC**

Replace the `resolve_transfer_recipient` call with the new `resolve_payment_merchant` RPC so the page works for unauthenticated guest users.

**3. `supabase/functions/checkout-guest/index.ts` — Use `.maybeSingle()` for recipient lookup**

Change `.single()` to `.maybeSingle()` on the recipient profile query (line 97-102) to prevent ambiguous error messages. Add logging for easier debugging.


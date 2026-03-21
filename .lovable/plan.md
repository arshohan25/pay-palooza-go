
Problem now: the payment page is resolving the merchant correctly, but the final guest checkout still fails inside the backend payment function.

What I verified:
- The payment link exists and is active:
  - short code: `252RWNS4`
  - merchant code: `MRC-RAFIQ-001`
- The merchant exists and is active:
  - `Rafiq Electronics`
- The merchant profile also exists and is active:
  - phone: `01909709954`
  - user_id matches the merchant
- The frontend merchant resolver works now:
  - `resolve_payment_merchant('MRC-RAFIQ-001')` returns the correct merchant
- The failure is now strictly in `checkout-guest`

Root cause:
- `checkout-guest` is still trying to resolve the recipient primarily from the client-sent `recipient_phone`
- Even though the payment link already tells us exactly which merchant should receive the money, the function only uses the link as a fallback
- In your failing request, logs show:
  - phone lookup failed
  - payment-link fallback started
  - final result still ended as `Recipient not found`
- So the bug is no longer “merchant not found”; it is “recipient resolution in checkout is not authoritative and not traceable enough”

Implementation plan

1. Make link-based recipient resolution authoritative
- In `checkout-guest`, if `reference` is present:
  - load the active `payment_links` row by `short_code`
  - resolve the merchant from `payment_links.merchant_id` first
  - fetch the recipient profile by merchant `user_id`
- Only use `recipient_phone` as a fallback for non-link/manual payment flows

2. Stop trusting the client for recipient identity
- Treat `recipient_phone` as display/input convenience only
- For payment-link flows, the backend should decide the real recipient from backend records, not from the request body
- This removes the current mismatch/fallback problem entirely

3. Tighten logging so the next failure is obvious
- Log each resolution stage separately:
  - payment link found or not
  - merchant found or not
  - merchant profile found or not
  - exact IDs used (`payment_link_id`, `merchant_id`, `merchant_user_id`)
- Return a more specific backend error instead of the generic `Recipient not found`

4. Small frontend hardening
- In `src/pages/PayPage.tsx`, optionally send `merchant_id` from the resolver result along with the request
- Backend should still verify it against the payment link before using it
- This gives one more stable identifier for debugging and validation

Technical details
```text
Current bad flow:
client recipient_phone -> profile lookup
   if that fails -> payment_links fallback
   if any fallback stage silently returns null -> "Recipient not found"

Planned safe flow:
reference(short_code) -> payment_links -> merchant_id -> merchants.user_id -> profiles
only if no reference exists:
  recipient_phone -> profiles
```

Files to update
- `supabase/functions/checkout-guest/index.ts`
- `src/pages/PayPage.tsx` (minor request hardening only)

Expected outcome
- `/pay?merchant=MRC-RAFIQ-001&ref=252RWNS4&amount=1` should complete using the merchant tied to the payment link
- The backend will no longer depend on fragile phone-based recipient matching for payment-link payments
- If anything still fails, the logs will identify the exact missing lookup stage instead of masking everything as “Recipient not found”

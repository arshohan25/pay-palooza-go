
Problem identified: the public merchant resolver function is broken, not the payment link itself.

What’s happening now:
- Your payment link exists and is active:
  - short code: `252RWNS4`
  - merchant code: `MRC-RAFIQ-001`
- The merchant also exists and is active:
  - `Rafiq Electronics`
- But the new backend function `resolve_payment_merchant()` crashes before it can return the merchant.

Root cause:
- The function was written against columns that do not exist in your current database schema:
  - it uses `merchants.qr_code` but the real column is `merchants.qr_code_data`
  - it uses `profiles.wallet_id` but `profiles` has no `wallet_id` column
- Because the RPC throws an error, `src/pages/PayPage.tsx` falls back to the “Merchant Not Found” screen.

Fix plan

1. Repair the backend resolver function
- Update `resolve_payment_merchant(p_identifier text)` to use `merchants.qr_code_data`
- Remove the invalid `profiles.wallet_id` lookup
- If wallet-style IDs must still work, use the existing `generate_wallet_id_from_phone(phone)` function instead of a missing column
- Keep phone-based merchant resolution as a fallback

2. Make the resolver match the actual app data model
- Merchant code lookup should resolve against `qr_code_data`
- Returned payload should still include:
  - `found`
  - `recipient_phone`
  - `recipient_name`
  - `merchant_id`
  - `category`

3. Improve `/pay` failure handling
- In `src/pages/PayPage.tsx`, distinguish between:
  - “merchant not found”
  - “merchant lookup failed”
- This prevents real backend errors from being shown as a fake “not found” state

4. Verify the exact broken link
- Re-test resolution for:
  - `MRC-RAFIQ-001`
  - `252RWNS4`-based pay URL flow
- Confirm the page loads the merchant and proceeds to OTP/PIN instead of the error card

Technical details
```text
Current broken references:
- merchants.qr_code        -> should be merchants.qr_code_data
- profiles.wallet_id       -> column does not exist

Safer wallet-ID fallback:
- compare UPPER(generate_wallet_id_from_phone(profiles.phone))
  instead of reading profiles.wallet_id
```

Files / areas to update
- `supabase/migrations/...` create a corrective migration for `resolve_payment_merchant`
- `src/pages/PayPage.tsx` improve RPC error handling

Expected outcome
- `/pay?merchant=MRC-RAFIQ-001&ref=252RWNS4&amount=1` resolves correctly
- The merchant page opens normally
- Active payment links remain valid until revoked/deleted
- Real backend failures are surfaced more accurately instead of showing “Merchant Not Found”

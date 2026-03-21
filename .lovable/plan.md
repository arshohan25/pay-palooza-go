
Problem now

The merchant and payment link are valid. The failure is inside `checkout-guest`, but not because the records are missing.

What I verified
- `payment_links.short_code = 252RWNS4` exists and is active
- `payment_links.merchant_id = 9cb25e4d-cfe8-4881-8d8c-54bb41ce94e6`
- merchant `Rafiq Electronics` exists and is active
- merchant profile exists and is active with phone `01909709954`
- `resolve_payment_merchant('MRC-RAFIQ-001')` works correctly

Actual root cause

`checkout-guest` starts with a service-role database client, but then uses this same client for:

```text
supabaseAdmin.auth.signInWithPassword(...)
```

That signs the client into the payer account and replaces the service-role session for subsequent queries on that client.

So after PIN verification, later reads are no longer running as full backend access:
- `payment_links` lookup gets blocked by RLS and returns no row
- merchant profile lookup gets blocked by RLS and returns null
- phone fallback also gets blocked by RLS and returns null

This exactly matches the logs:
```text
payment link exists in DB
but function logs "No active payment link"

merchant lookup by id works
but recipient_phone is undefined

phone fallback runs
but final result is still Recipient not found
```

Implementation plan

1. Split auth verification from database access
- Keep one client strictly for backend data reads/writes
- Create a separate auth-only client for `signInWithPassword`
- Never use the auth-verified client for payment link/profile/transaction queries

2. Keep all recipient resolution on the backend DB client
- Resolve `reference -> payment_links -> merchant_id -> merchants -> profiles`
- Use `recipient_phone` only for true non-link/manual flows
- Ensure all post-auth reads still run through the backend DB client

3. Add one explicit debug log to confirm client separation
- Log when PIN auth succeeds
- Log that recipient resolution is running with backend lookup path
- Log whether the payment link was found before and after PIN verification is removed from the shared client path

4. Small cleanup in `checkout-guest`
- Reorder the flow so recipient resolution does not depend on the auth client at all
- Keep transaction inserts and balance updates on the backend DB client only
- Return a more specific error if the payment link exists but the merchant profile is missing

Files to update
- `supabase/functions/checkout-guest/index.ts`

Technical details
```text
Current broken flow:
service-role client
  -> verify OTP
  -> signInWithPassword on same client
  -> client session becomes payer user
  -> payment_links / profiles queries now hit RLS
  -> false "Recipient not found"

Planned safe flow:
dbClient (service-role) -> OTP + payment_links + merchants + profiles + transactions
authClient (separate)   -> signInWithPassword only
```

Expected outcome
- `/pay?merchant=MRC-RAFIQ-001&ref=252RWNS4&amount=1` should stop failing with the fake recipient error
- payment link lookup should succeed consistently
- merchant profile should resolve correctly
- the remaining failure, if any, will be the real one instead of an RLS side effect

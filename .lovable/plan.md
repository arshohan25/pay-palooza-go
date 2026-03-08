

## Fix: merchant-payment-api Edge Function Returning 500

### Root Cause
The `merchant-payment-api` edge function is **missing from `supabase/config.toml`**, so it defaults to `verify_jwt = true`. While the function still boots and runs (due to signing-keys behavior), the internal error is silently swallowed by the generic `catch` block on line 163 with no logging.

### Investigation Results
- API key generation works correctly (confirmed via browser — key `epk_65de64a69d7d404985e725d67f49f142` created and visible)
- Database schema for `merchant_api_keys` and `merchant_payment_sessions` is correct
- The API key exists and is active in the database
- Edge function boots successfully but returns `{"error":"Internal server error"}` (500)
- No error logs appear because the catch block silently returns a generic error

### Fix (2 changes)

**1. Add `merchant-payment-api` to `supabase/config.toml`**
```toml
[functions.merchant-payment-api]
verify_jwt = false
```

**2. Add error logging to the catch block in `supabase/functions/merchant-payment-api/index.ts`**
```typescript
} catch (err) {
  console.error("merchant-payment-api error:", err);
  return json({ error: "Internal server error" }, 500);
}
```

### Verification
After deploying, re-test creating a payment session with the existing API key. If a deeper issue surfaces from the logs, we'll fix that in a follow-up.

| File | Change |
|------|--------|
| `supabase/config.toml` | Add `[functions.merchant-payment-api]` with `verify_jwt = false` |
| `supabase/functions/merchant-payment-api/index.ts` | Add `console.error` in catch block |




## Fix: Incorrect PIN on Guest Checkout

### Root Cause
The `checkout-guest` Edge Function only tries to authenticate with `{phone}@easypay.app`. However, some users registered with fallback email domains (`@example.com`, `@easypay.local`). When `signInWithPassword` fails on the primary domain, the function returns "Incorrect PIN" even though the PIN is correct.

The client-side `signIn()` in `src/lib/auth.ts` already handles this by looping through multiple domains — the edge function needs the same logic.

### Fix in `supabase/functions/checkout-guest/index.ts`

**Replace the single-domain PIN check (lines 79-86)** with a multi-domain loop:

```typescript
// 3. Verify PIN via auth — try all known email domains
const password = `${pin}EP`;
const emailDomains = ["easypay.app", "example.com", "easypay.local"];
let authPassed = false;

for (const domain of emailDomains) {
  const { error } = await supabaseAdmin.auth.signInWithPassword({
    email: `${cleanPhone}@${domain}`,
    password,
  });
  if (!error) { authPassed = true; break; }
}

if (!authPassed) {
  return jsonRes({ error: "Incorrect PIN" }, 400);
}
```

This mirrors the client-side fallback logic and ensures users registered under any domain can authenticate correctly.

### Single file change
- `supabase/functions/checkout-guest/index.ts` — multi-domain PIN verification loop


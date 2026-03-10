

## Fix: Transaction Flows Resetting After PIN Verification

### Root Cause

**`verifyPin` uses `supabase.auth.signInWithPassword`**, which creates a new session and triggers the global `onAuthStateChange` listener. This fires asynchronously AFTER the success step is set, causing:

1. `useAuth` hook updates `session`/`user` references
2. Index re-renders with new auth state
3. Flow components inside `AnimatePresence` (without explicit keys) get remounted by framer-motion, resetting their internal `step` state back to the initial value (e.g., "recipient")

Additionally, `SendMoneyFlow`'s `handlePinConfirm` lacks try-catch around `transferMoney`, which could cause unhandled errors in some edge cases.

### Fix (3 changes)

**1. `src/lib/verifyPin.ts`** — Call the auth API directly via `fetch` instead of `supabase.auth.signInWithPassword`. This verifies the PIN without disrupting the client session or triggering `onAuthStateChange`.

```typescript
// Before: supabase.auth.signInWithPassword({ email, password })
// After: Direct fetch to /auth/v1/token endpoint
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`,
  { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ... },
    body: JSON.stringify({ email, password: pinToPassword(pin) }) }
);
return response.ok;
```

**2. `src/pages/Index.tsx`** — Add explicit `key` props to all flow components inside `AnimatePresence` to prevent framer-motion from losing component identity during parent re-renders.

**3. `src/components/SendMoneyFlow.tsx`** — Wrap `transferMoney` in try-catch (matching how PaymentFlow and CashOutFlow already handle it).

### Files to Change

| File | Change |
|---|---|
| `src/lib/verifyPin.ts` | Replace `signInWithPassword` with direct fetch to auth API |
| `src/pages/Index.tsx` | Add `key` props to flow components in AnimatePresence |
| `src/components/SendMoneyFlow.tsx` | Add try-catch around `transferMoney` call |


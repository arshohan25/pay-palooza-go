

## Fix: PIN not reset on validation failure (Savings flow)

### Why it happened (root cause)

In the screenshot, the user typed a PIN of `••••` with amount `0`, slid to confirm, and got **"Enter a valid amount"** — but the PIN dots stayed filled. Reason: every transaction handler in `SavingsFlow.tsx` (8 of them) does its `parseFloat`/`balance`/`goal` validations **before** clearing the PIN, then early-returns:

```ts
const handleSave = async () => {
  if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }   // ← PIN never cleared
  if (amt > balance)    { setError("Insufficient balance"); return; }    // ← PIN never cleared
  if (!selectedGoal)    { setError("Select a savings goal"); return; }   // ← PIN never cleared
  if (pin.length < 4)   { setPinError("Enter your 4-digit PIN"); return; }
  ...
};
```

The slider is `disabled={pin.length < 4}` — so the user *must* have a full PIN to even reach validation. Any failed pre-check leaves a stale PIN sitting in state, which is both confusing UX and a security smell (typed PIN persists across an unrelated error).

A purpose-built hook already exists for exactly this — `src/hooks/use-pin-state.ts` exposes `clearPin()` / `failPin(msg)` — but `SavingsFlow.tsx` doesn't use it.

### The fix

**Rule:** any early-return from a slide-confirm handler must clear the PIN. Every validation `return` after the slide gesture means the user has to re-enter PIN — that's the safe and expected MFS behavior (matches Send Money / Cash Out / Pay Bill flows).

Apply this to all 8 affected handlers in `src/components/SavingsFlow.tsx`:

| Handler | Lines |
|---|---|
| `handleSave` (goal deposit — the bug in the screenshot) | 354 |
| `handleCreateGoal` | 375 |
| `handleCreateAutoSave` | 429 |
| `handleRepayMissed` | 493 |
| `handleBuyGold` | 545 |
| `handleSellGold` | 569 |
| `handleBuyStock` | ~600 |
| `handleSellStock` | ~625 |

Pattern change (example for `handleSave`):

```ts
const handleSave = async () => {
  const amt = parseFloat(amount);
  // Helper: any pre-check failure clears PIN so user re-enters intentionally
  const fail = (msg: string) => { setError(msg); setPin(""); setPinError(""); };

  if (!amt || amt <= 0) return fail("Enter a valid amount");
  if (amt > balance)    return fail("Insufficient balance");
  if (!selectedGoal)    return fail("Select a savings goal");
  if (pin.length < 4)   { setPinError("Enter your 4-digit PIN"); return; }
  ...
};
```

Also ensure the **catch block** clears PIN (most already do `setPin("")`; verify all 8).

### Prevent recurrence (cheap guardrail)

Add a one-line comment block at the top of the handlers section in `SavingsFlow.tsx`:

```ts
// ⚠️ PIN-reset rule: every early-return after PIN entry MUST clear pin
// (call setPin("") + setPinError("")). Use the `fail()` helper below.
```

This makes the rule visible to future edits without a refactor.

### Out of scope (not changing now)

- Not migrating SavingsFlow to `usePinState` hook — would touch ~30 lines of state for cosmetic gain. The `fail()` helper achieves the same safety locally.
- Not touching other files (LoanPage, MerchantDashboard) — they're not in the bug report; can audit in a follow-up if desired.
- No UI/visual changes.

### Files touched

- `src/components/SavingsFlow.tsx` — add `fail()` helper, update 8 handlers to clear PIN on early-return.




# Reset PIN on Back Navigation from Review Step

## Problem
When the user presses back from the Review & Confirm page, the PIN input retains the previously entered digits. The PIN should reset every time the user navigates back, so they must re-enter it on each visit.

## Changes (1 file: `src/components/SavingsFlow.tsx`)

### Update `handleBack` to clear PIN and related state when leaving the review step

In the `handleBack` function (line ~469), when stepping back from `"review"` to `"autosave"`, also reset:
- `pin` → `""`
- `pinError` → `""`
- `termsAccepted` → `false`

This ensures every time the user enters the review page, the PIN field is empty and T&C checkbox is unchecked — requiring fresh confirmation each time.

```typescript
if (step === "review") {
  setPin("");
  setPinError("");
  setTermsAccepted(false);
  setStep("autosave");
}
```

This same pattern should also apply to the other flows (gold buy/sell, stock buy/sell, manual deposit) — whenever the user navigates back from a confirmation step, reset PIN state. I'll audit all `handleBack`/navigation paths and add `setPin(""); setPinError("");` wherever a step transition occurs away from a PIN entry screen.


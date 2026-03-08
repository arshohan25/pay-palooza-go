

## Plan: Add Phone Number Validation Feedback Animation

### What
Add a shake animation + red border + helper text when an invalid Bangladeshi phone number is entered (doesn't start with `01` or is incomplete when user attempts to submit/continue).

### Changes

**1. Add `shake` keyframe to `tailwind.config.ts`**
- Add a horizontal shake keyframe (`animate-shake`) for invalid input feedback.

**2. Create a reusable hook `src/hooks/use-phone-validation.ts`**
- Accepts `phone` string, returns `{ isValid, showError, triggerShake, shakeClass, errorMessage }`.
- Validation: must be 11 digits starting with `01`.
- `triggerShake()` sets a transient `shaking` state that auto-clears after 500ms.
- `showError` activates when phone is non-empty, length > 2, and doesn't start with `01`, OR when `triggerShake` is called with an incomplete number.

**3. Update phone input pages** (5 files)
- `AgentRegister.tsx`, `AgentCashIn.tsx`, `AgentB2B.tsx`, `DistributorCreateAgent.tsx`, `MerchantDashboard.tsx`
- Import the hook, apply `shakeClass` + red border conditionally to the Input, show error message text below.
- Call `triggerShake()` when user taps the submit/continue button with an invalid number (before returning early).

### Animation detail
```
shake: { 0%, 100%: translateX(0), 20%, 60%: translateX(-6px), 40%, 80%: translateX(6px) }
```
Duration: 0.4s. Combined with `border-destructive` and a fade-in error message like "Enter a valid 11-digit number starting with 01".


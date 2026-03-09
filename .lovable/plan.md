

## Enforce One Account Per Phone Number

### Problem
The signup flow in `AuthPage.tsx` does not check if a phone number is already registered before calling `signUp()`. The `isPhoneRegistered()` function exists in `src/lib/auth.ts` but is never used. Same issue in `AgentRegister.tsx` and `SuperDistributorCreateDistributor.tsx`.

### Changes

**1. `src/pages/AuthPage.tsx`** — In `handleRegisterPhone()` (line 362), before navigating to OTP step, call `isPhoneRegistered(phone)`. If true, show error "Already registered. Please log in." and block progression.

**2. `src/pages/AgentRegister.tsx`** — In `handleRegister()`, before creating the account, check if the phone is already in the `profiles` table. If yes, show toast "This number is already registered."

**3. `src/pages/SuperDistributorCreateDistributor.tsx`** — In `handleCreate()`, same check before `signUp`. Show error if phone already exists.

All three files use the same pattern: query `profiles` table by phone before attempting account creation.


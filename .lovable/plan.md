## Fix: PIN Still Requiring 6+ Characters

### Root Cause

The Supabase Auth backend is returning a 422 error on signup with the password `1234EPAY` (8 chars). This means the project's auth configuration likely has a minimum password length set higher than 8, OR there's another validation rejecting the signup.

### Solution

Two-pronged fix to ensure this works regardless of the backend's minimum password length setting:

**1. Increase PIN padding significantly in `src/lib/auth.ts**`

Change `pinToPassword` from `${pin}EPAY` to a longer, safer padding that will pass any reasonable minimum password length (e.g., 12+ chars):

```typescript
export const pinToPassword = (pin: string) => `EP${pin}SECUREWALLETPIN`;
// e.g., "1234" → "EP1234SECUREWALLETPIN" (21 chars)
```

This ensures the password passes even if the minimum is set to 10, 12, or higher. Since all auth flows (`signUp`, `signIn`, `changePin`, `verifyPin`) use the same `pinToPassword` function, this change is consistent everywhere.

**2. Attempt to configure auth minimum password length to 4**

Use the available tools to try setting the minimum password length to 4 as a belt-and-suspenders approach.

### Files Changed

- `src/lib/auth.ts` — Update `pinToPassword` padding

### Important Note

Existing users who signed up with the old padding (`EP` or `EPAY`) will not be able to log in after this change. If there are existing users, we may need a migration strategy. Since this appears to be early development with no real users yet, this should be safe.
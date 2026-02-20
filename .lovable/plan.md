

## Returning User Login Improvements

### What Changes

**1. Hide "Create Account" for returning users on the login PIN screen**

Currently, when a returning user reaches the login PIN screen, they see a "Forgot PIN?" link and a back button that leads to the landing page where "Create an account" is still accessible. After a successful login, the `DEVICE_KEY` is stored in localStorage, marking them as a returning user.

The change will:
- On the **landing page** for returning users (`!isNewUser`), remove the "New user? Create an account" secondary link. Only the "Log In to Wallet" button and "Forgot PIN?" will remain.
- On the **login PIN screen**, keep only "Forgot PIN?" (already the case -- no create account link there).

**2. Lock account after 5 consecutive wrong PIN attempts**

Add a lockout mechanism that blocks login attempts for a cooldown period after 5 consecutive failed PINs.

---

### Technical Details

**File: `src/pages/AuthPage.tsx`**

**Change 1 -- Hide "Create Account" for returning users:**
- In the landing page section (lines 617-626), when `!isNewUser` (returning user), instead of showing "New user? Create an account", show nothing or only a "Forgot PIN?" link.
- The returning user flow already goes straight to `login_pin`, so the landing acts as a brief pass-through. The secondary "Create an account" link will be removed for returning users.

**Change 2 -- Account lockout after 5 failed attempts:**
- Add state: `failedAttempts` (number, default 0) and `lockUntil` (timestamp or null).
- Store lockout state in `localStorage` keyed by phone number so it persists across page refreshes.
- In `handleLoginPin`, before attempting sign-in:
  - Check if currently locked (lockUntil > Date.now()). If so, show an error with remaining time and return early.
  - On failed PIN attempt, increment `failedAttempts`. If it reaches 5, set `lockUntil` to `Date.now() + 5 * 60 * 1000` (5-minute lockout).
  - On successful login, reset `failedAttempts` and clear `lockUntil`.
- Show a countdown timer in the error message when locked (e.g., "Account locked. Try again in 4:32").
- Add translations for lockout messages in both English and Bangla.

**Lockout storage keys:**
- `mfs_lock_attempts_{phone}` -- number of failed attempts
- `mfs_lock_until_{phone}` -- timestamp when lock expires


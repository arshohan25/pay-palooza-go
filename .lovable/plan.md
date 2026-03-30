

# Auto-Skip to PIN Screen for Returning Users

## Problem
Currently, when a device-bound user (phone stored in `mfs_device_phone`) opens the app, they still see the **landing page** first and must tap "Log In to Wallet" to reach the PIN screen. The user wants returning users to see the PIN entry screen **directly** — like bKash/Nagad/Rocket (as shown in the reference screenshot).

## Current Flow
1. AuthPage always starts at `mode = "landing"`
2. User taps "Log In to Wallet" → sets phone from `returningPhone` → navigates to `login_pin`
3. PIN screen appears

## Desired Flow
1. AuthPage detects `mfs_device_phone` in localStorage (device already bound via OTP)
2. Skips landing entirely → starts directly at `login_pin` with phone pre-filled
3. User sees the green gradient PIN screen immediately

## Changes

### `src/pages/AuthPage.tsx`
1. **Change initial `mode` state**: Instead of always starting at `"landing"`, check `returningPhone` and start at `"login_pin"` if device is bound:
   ```typescript
   const [mode, setMode] = useState<Mode>(() => {
     const saved = localStorage.getItem(DEVICE_KEY);
     return saved ? "login_pin" : "landing";
   });
   ```

2. **Pre-fill phone for returning users**: Change the `phone` initial state to use `returningPhone` when available:
   ```typescript
   const [phone, setPhone] = useState(() => localStorage.getItem(DEVICE_KEY) ?? "");
   ```

3. **Update back button from `login_pin`**: When user is a returning user who started directly on PIN screen, pressing back should go to `landing` (not `login_phone`):
   - Current: `if (mode === "login_pin") { goTo("login_phone", -1); }`
   - New: `if (mode === "login_pin") { goTo("landing", -1); }`

These are minimal changes — no new files, no new components. The existing `login_pin` UI already matches the reference screenshot (green gradient, lock icon, PIN dots, "Returning User" badge, "Forgot PIN?" link).

## Files Changed
- `src/pages/AuthPage.tsx` — 3 line changes (initial mode, initial phone, back handler)


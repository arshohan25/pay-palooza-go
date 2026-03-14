

## Fix InstallPrompt Overlay Blocking Auth Page

### Problem
The `InstallPrompt` banner at `z-[200]` overlaps the auth page buttons, preventing users from tapping "Create Free Account" or "Sign In".

### Changes

**File: `src/components/InstallPrompt.tsx`**
1. Add `/auth` to the suppression check — don't render the install banner when on the auth page (alongside existing `/install` suppression)
2. Switch dismissal storage from `sessionStorage` to `localStorage` so it persists across sessions


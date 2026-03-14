

## Fix: "Unable to validate email address: invalid format"

### Root Cause
Supabase's auth system rejects emails with `.local` TLD (e.g. `01712345678@easypay.local`) because it's not a valid public domain suffix. The error occurs during `signUp()`.

### Fix
Change the synthetic email domain from `easypay.local` to `easypay.app` (a valid TLD that passes validation) in `src/lib/auth.ts`. Also update the team domain.

**File: `src/lib/auth.ts`**
- Line 14: `"easypay.local"` → `"easypay.app"`
- Line 16: `"team.easypay.local"` → `"team.easypay.app"`

**File: `src/pages/AgentRegister.tsx`**
- Line 37: Update hardcoded `@easypay.local` to `@easypay.app`

No other logic changes needed -- `phoneToEmail()` is used everywhere else so they'll pick up the new domain automatically.


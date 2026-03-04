

## Fix "User not found" when adding contacts by phone number

### Root Cause

Two cascading bugs:

1. **Trigger stores email as phone**: The `handle_new_user()` trigger uses `COALESCE(NEW.phone, NEW.email, '')`. Since we use phone-as-email auth (not real phone auth), `NEW.phone` is always null, so the trigger stores `01680693484@easypay.local` as the phone value.

2. **Hardened RLS blocks phone correction**: The recently hardened RLS policy on `profiles` prevents clients from changing the `phone` field. So when `signUp()` tries to update `phone` to the correct value (`01680693484`), the update silently fails.

3. **Lookup mismatch**: `findUserByPhone("01680693484")` queries `.eq("phone", "01680693484")` but the stored value is `01680693484@easypay.local` — no match, "User not found".

### Changes

**1. Database migration — Fix the trigger + repair existing data**

- Update `handle_new_user()` to extract the phone number from the email by stripping `@easypay.local` suffix when `NEW.phone` is null
- Fix existing corrupted phone values: `UPDATE profiles SET phone = REPLACE(phone, '@easypay.local', '') WHERE phone LIKE '%@easypay.local'`

**2. Fix `findUserByPhone` in `src/hooks/use-chat.ts`**

- Normalize the input phone (strip spaces/dashes) and also try matching with both raw phone and `@easypay.local` suffix as a fallback for any edge cases

**3. No RLS changes needed**

The trigger runs as `SECURITY DEFINER` so it bypasses RLS. Once the trigger stores the correct phone from the start, the `signUp` phone update becomes unnecessary (it would set the same value). The hardened RLS protecting `phone` from client changes remains correct.

### Files
- **DB Migration**: Fix `handle_new_user()` trigger + repair existing data
- **Edit**: `src/hooks/use-chat.ts` — make `findUserByPhone` resilient to format variations


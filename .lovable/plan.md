

## Plan: Fix admin-reset-team-password Edge Function

### Problems Found

1. **`userClient.auth.getClaims()` does not exist** in the Supabase JS SDK. This will throw a runtime error. Should use `userClient.auth.getUser()` instead.
2. **Double `req.json()` call** — the request body is consumed once during auth verification setup, then `await req.json()` is called again on line 58 to read `targetUserId` and `newPassword`. Since the body stream can only be read once, the second call will fail.

### Fix

**File: `supabase/functions/admin-reset-team-password/index.ts`**

- Parse `req.json()` once at the top, extract all fields (`targetUserId`, `newPassword`)
- Replace `getClaims()` with `getUser()` to extract the caller's user ID
- Use the same auth pattern as other working edge functions in this project (e.g., `admin-reset-pin`)

### Files Modified
- `supabase/functions/admin-reset-team-password/index.ts` — Fix auth verification and body parsing


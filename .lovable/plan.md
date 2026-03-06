

## Plan: Fix All Security Scan Errors

Three security findings need to be resolved:

### 1. Auto-Purge Endpoint Has No Authentication (Critical)

**File:** `supabase/functions/auto-purge-deactivated/index.ts`

The function is publicly callable with no auth check. Fix by adding a shared secret check at the top of the handler. The function should verify that the request includes a `Bearer` token matching a stored `AUTO_PURGE_SECRET` environment secret. This is appropriate because this function is meant to be called by a cron job, not by users.

- Add secret validation at the start of the request handler
- Use `secrets--add_secret` to prompt the user to set `AUTO_PURGE_SECRET`

### 2. Profiles Table - "Customer personal data is publicly readable"

**Fix via migration:** The existing RLS policies on `profiles` use `RESTRICTIVE` policies correctly, but the scanner flags that `auth.uid() = user_id` evaluates to NULL for unauthenticated users. The policies are already restrictive (`Permissive: No`), which means they default-deny. However, to be explicit and satisfy the scanner, we should add an additional check: wrap the `USING` clause with an `auth.uid() IS NOT NULL` guard on the user's own SELECT policy.

- Drop and recreate the "Users can view own profile" policy with `(auth.uid() IS NOT NULL AND auth.uid() = user_id)`
- Drop and recreate the "Users can update own profile metadata" policy similarly
- Drop and recreate the "Users can create own profile" policy similarly

### 3. KYC Verifications - "Identity verification documents are publicly readable"

Same pattern as profiles. Add explicit `auth.uid() IS NOT NULL` guards to user-facing policies.

- Drop and recreate "Users can view own kyc" with `(auth.uid() IS NOT NULL AND auth.uid() = user_id)`
- Drop and recreate "Users can create own kyc" and "Users can update own pending kyc" similarly

### Files to modify
- `supabase/functions/auto-purge-deactivated/index.ts` - add secret-based auth
- Database migration for `profiles` and `kyc_verifications` RLS policy updates


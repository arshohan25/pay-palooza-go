

# Fix: Restore `has_role()` to use `_user_id` parameter

## Problem
The `has_role(_user_id, _role)` function ignores its `_user_id` argument and always checks `auth.uid()`. This breaks any internal RPC that needs to verify another user's role (e.g., `release_escrow` checking if the caller is admin via `has_role(v_admin_id, 'admin')`). While current call sites pass `auth.uid()` so behavior happens to be correct today, this is fragile and semantically wrong.

## Fix (single migration)

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_role FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated;
```

- Uses `_user_id` parameter as intended
- `SECURITY DEFINER` bypasses RLS on `user_roles` (preventing recursion)
- `REVOKE FROM PUBLIC` + `GRANT TO authenticated` prevents anonymous callers from probing roles

## Risk
Zero — every existing call site already passes `auth.uid()` as `_user_id`, so behavior is identical. The fix simply makes the function correct for future use.


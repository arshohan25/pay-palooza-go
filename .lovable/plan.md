

## Problem

The `isPhoneRegistered()` function queries the `profiles` table to check if a phone number exists. However, the RLS policy on `profiles` only allows authenticated users to view **their own** profile. On the login/registration screen, the user is **not authenticated**, so the query returns zero rows every time — making every number appear "not registered."

This worked before because the old code likely used a different check or the RLS was more permissive.

## Fix

Create a **security definer** database function that safely checks if a phone number exists without exposing any profile data. Then update the frontend to call this function instead of querying the table directly.

### 1. Database migration — create `is_phone_registered` RPC

```sql
CREATE OR REPLACE FUNCTION public.is_phone_registered(p_phone text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_norm text;
BEGIN
  v_norm := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  IF left(v_norm, 2) = '88' AND length(v_norm) > 11 THEN
    v_norm := substring(v_norm FROM 3);
  END IF;
  IF v_norm !~ '^01[3-9][0-9]{8}$' THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE phone = v_norm LIMIT 1
  );
END;
$$;
```

### 2. Update `src/lib/auth.ts` — `isPhoneRegistered()`

Replace the current implementation that does `supabase.from("profiles").select(...)` with:

```typescript
export async function isPhoneRegistered(phone: string): Promise<boolean> {
  const normalizedPhone = normalizeBdPhone(phone);
  if (!BD_PHONE_REGEX.test(normalizedPhone)) return false;

  const { data, error } = await supabase.rpc("is_phone_registered", {
    p_phone: normalizedPhone,
  });

  if (error) throw error;
  return data === true;
}
```

This bypasses RLS via the security definer function while only exposing a boolean — no profile data leaks.


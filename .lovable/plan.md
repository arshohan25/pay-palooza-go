

# Security Fix: Merchant Bank Data Exposure & Role Enumeration

## Issues

1. **Merchant bank details publicly readable** -- The `Public can read active merchants for shop` RLS policy uses `status = 'active'` with no auth check, exposing `bank_account_number`, `bank_routing`, `trade_license`, `mdr_rate`, and other sensitive fields to anonymous users.

2. **Role enumeration via `has_role()` function** -- The `has_role(_user_id, _role)` function accepts any UUID, allowing authenticated users to probe other users' roles.

## Plan

### Step 1: Create a safe public merchants view (Migration)

Create a database view `merchants_public` that only exposes non-sensitive columns (`id`, `user_id`, `business_name`, `category`, `qr_code_data`, `status`, `created_at`). Then replace the dangerous public RLS policy.

```sql
-- Create a view with only safe columns
CREATE VIEW public.merchants_public AS
SELECT id, user_id, business_name, category, qr_code_data, status, created_at
FROM public.merchants
WHERE status = 'active';

-- Drop the overly permissive public policy
DROP POLICY "Public can read active merchants for shop" ON public.merchants;

-- Re-create as authenticated-only, so only logged-in users can read active merchants
-- (the view handles public/anonymous access without sensitive data)
CREATE POLICY "Authenticated can read active merchants"
ON public.merchants
FOR SELECT TO authenticated
USING (status = 'active');
```

### Step 2: Harden `has_role()` function (Migration)

Replace the function so it only checks the **caller's own** roles, removing the `_user_id` parameter from the public signature. Internal RLS policies already pass `auth.uid()`, so no policy changes needed.

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = _role
  )
$$;
```

This ignores the `_user_id` parameter and always checks `auth.uid()`. Since every call site already passes `auth.uid()`, behavior is identical for legitimate use, but attackers can no longer probe other users' roles.

### Step 3: Update client code

Update `get_shop_products` RPC (already a SECURITY DEFINER function) -- no change needed, it joins merchants internally.

Check any client-side `.from("merchants").select(...)` calls used for shop/public pages. The existing `get_shop_products` RPC already handles this safely. For the `VendorStorePage` and `ShopPage`, verify they use the RPC or only query safe columns.

### Technical Details

- The `merchants_public` view runs under the definer's permissions, bypassing RLS, so anonymous users can query it for shop browsing without seeing bank details
- All existing admin/owner policies on `merchants` remain unchanged
- The `has_role()` signature stays the same (2 params) so no SQL policy rewrites are needed -- it just internally ignores the first param


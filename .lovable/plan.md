

## Problem

Products don't show on the Shop page for regular (non-admin, non-merchant) users.

**Root cause**: The product query uses `merchants!inner(id, business_name, user_id)` — an inner join on the `merchants` table. The `merchants` table has RLS that only allows:
- The merchant themselves (`auth.uid() = user_id`)
- Admins (`has_role(auth.uid(), 'admin')`)

A regular customer has no SELECT access to `merchants`, so the inner join returns zero rows, hiding all products.

## Solution

Add a public SELECT policy on the `merchants` table that exposes only the non-sensitive columns needed for the shop (id, business_name). Since RLS operates at the row level (not column level), the simplest fix is to allow authenticated users to read merchant rows:

### 1. Add RLS policy on `merchants` for public read

```sql
CREATE POLICY "Anyone can read merchants for shop"
ON public.merchants
FOR SELECT
TO authenticated
USING (true);
```

This replaces the restrictive "Merchants can view own record" policy scope. Since the existing admin policy already covers admin access, we just need to widen the SELECT for authenticated users. The `merchants` table contains business info (business_name, category, etc.) which is appropriate for public visibility.

Alternatively, to be more conservative, drop the existing SELECT policy and replace it:

```sql
DROP POLICY "Merchants can view own record" ON public.merchants;

CREATE POLICY "Authenticated users can read merchants"
ON public.merchants
FOR SELECT
TO authenticated
USING (true);
```

### 2. No code changes needed

The ShopPage query will work as-is once the RLS policy allows reading `merchants`.

### Technical detail

- The `merchants` table stores business-facing data (business_name, category, phone, status) — not sensitive PII that needs hiding
- INSERT/UPDATE/DELETE policies remain restricted to the merchant owner and admins
- Only SELECT is broadened


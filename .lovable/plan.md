

# Fix: Products Not Showing on User App

## Root Cause
The `merchants` table has a restrictive SELECT RLS policy: only the merchant owner (`auth.uid() = user_id`) or admins can read rows. The ShopPage query uses `merchants!inner(id, business_name, user_id)` — an inner join that requires reading the `merchants` table. Regular users are blocked by RLS, so the join returns no rows, and therefore no products appear.

## Fix
Add a public SELECT policy on the `merchants` table that allows anyone to read active merchant records. This is safe because merchant profiles (business name, etc.) are meant to be public-facing storefront info.

### Database migration
```sql
CREATE POLICY "Anyone can view active merchants"
  ON public.merchants
  FOR SELECT
  TO public
  USING (status = 'active');
```

This single policy change will make the existing ShopPage query work for all users — no code changes needed.

## Summary
- 1 database migration: add public read policy for active merchants


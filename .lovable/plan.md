

## Fix: Product Not Found + Merchant Floating Chat Button

### Problem 1: "Product not found" on user side
The product detail page query uses `merchants!inner(...)`. The `merchants` table has a SELECT policy for `authenticated` role only, but `merchant_products` allows `public` (anon) reads. When a user is not logged in (or session expired), the inner join on `merchants` fails, returning no product.

**Fix**: Add a SELECT policy on `merchants` for the `public` role so unauthenticated users can also view products. The existing "Authenticated users
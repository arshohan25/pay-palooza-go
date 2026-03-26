

# Fix: Remove Broad Merchant Read Policy

## Problem
The `Authenticated can read active merchants` RLS policy on the `merchants` table grants every authenticated user SELECT access to all columns — including `bank_account_number`, `bank_routing`, `trade_license`, `mdr_rate`, etc.

## Solution
Drop that policy. The table already has:
- **"Merchants can view own record"** — allows the merchant owner and admins to read their own record
- **"Admins can manage merchants"** — full admin access
- **`get_public_merchants()` function** — SECURITY DEFINER RPC returning only safe columns for shop browsing

No replacement policy is needed. Any code querying merchants for shop/discovery already uses the RPC or joins via `get_shop_products()`.

## Migration

```sql
DROP POLICY "Authenticated can read active merchants" ON public.merchants;
```

One line. That's it.

## Post-fix
Delete the security finding via the manage tool.


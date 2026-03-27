

# Products Active but Not Showing on User App

## Root Cause
The ShopPage (`/shop`) does **not** have realtime subscriptions — unlike the ShopFlow component which subscribes to `postgres_changes`. When you toggle a product to active on the merchant dashboard, the shop page won't update until the user navigates to it fresh or refreshes.

Additionally, the ShopPage fetches products directly from the `merchant_products` table (not the `get_shop_products` RPC), and both the RLS policy and query filter correctly for `is_active = true`. The data access is fine.

## Fix

### 1. Add realtime subscription to ShopPage
**File**: `src/pages/ShopPage.tsx` (~line 239)

After the product-loading `useEffect`, add a realtime channel that re-fetches products when any `merchant_products` row changes (insert/update/delete). This mirrors the pattern already used in `ShopFlow.tsx`:

```typescript
useEffect(() => {
  const channel = supabase
    .channel("shop-page-products-rt")
    .on("postgres_changes", { event: "*", schema: "public", table: "merchant_products" }, () => {
      // re-run the load function
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, []);
```

The load function needs to be extracted into a `useCallback` so it can be called from both the initial `useEffect` and the realtime handler.

## Summary
- 1 file edit: `src/pages/ShopPage.tsx` — extract fetch logic into reusable callback, add realtime subscription for `merchant_products` table changes


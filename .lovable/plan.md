

## Live update for Gold & Stock prices in the Savings UI

### Root cause

`useStockPrices` and `useGoldPrice` poll every 30s and update local state, but the **Savings page** (`SavingsFlow.tsx`) renders prices from its own `holdings` rows (loaded once via `loadHoldings`). When the polling hook fetches new prices and PATCHes `stock_holdings.current_price`, the Savings UI doesn't re-read — so the displayed Stocks/Gold tiles never refresh.

Network log confirms: `stock-price` is fetched every ~6s and `stock_holdings` is PATCHed with `current_price: 242.8`, but the UI keeps showing stale numbers because no `loadHoldings()` is triggered after the PATCH.

Also, the gold price edge function is returning `source: "fallback"` (Swissquote upstream failed) → flat 16,200/19,500. That's a separate upstream issue but explains why Gold "never moves".

### Fix

**1. `src/components/SavingsFlow.tsx`** — make holdings re-render on live price changes:
- In the existing realtime subscription block for `stock_holdings` and `gold_holdings`, also re-invoke `loadHoldings()` on UPDATE events (not just INSERT/DELETE). Confirm channel filter is `event: '*'`.
- Add a lightweight effect that, when `useStockPrices().stocks` or `useGoldPrice().price22k` changes, **merges the new price into local `stockHoldings`/`goldHoldings` state by symbol** — this gives instant flicker-free updates without waiting for the DB round-trip.

```ts
useEffect(() => {
  if (!stocks.length) return;
  setStockHoldings(prev => prev.map(h => {
    const live = stocks.find(s => s.symbol === h.symbol);
    return live ? { ...h, current_price: live.price, change: live.change } : h;
  }));
}, [stocks]);

useEffect(() => {
  setGoldHoldings(prev => prev.map(h => ({ ...h, current_price_per_gram: h.purity === '24k' ? price24k : price22k })));
}, [price22k, price24k]);
```

**2. `supabase/functions/gold-price/index.ts`** — fix fallback source:
- Add a secondary provider (e.g. `https://api.gold-api.com/price/XAU`) before falling back to the hardcoded ৳16,200/৳19,500. This brings Gold off the flat fallback so users see live movement.

### Files touched
- `src/components/SavingsFlow.tsx` — add 2 useEffects to merge live prices into holdings state; verify realtime channel uses `event: '*'`.
- `supabase/functions/gold-price/index.ts` — add backup gold-spot provider before fallback.

### Out of scope
- Changing the 30s polling interval (already reasonable).
- Backfilling historical price snapshots.


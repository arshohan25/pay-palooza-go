

The user is asking how the **Investment P/L** dashboard works. This is a Q&A, not an implementation request — no plan needed, but since I'm in plan mode I'll explain clearly.

## How the Investment P/L dashboard works

**Where to find it:** Admin Dashboard → "Investment P/L" tab (TrendingUp icon, under Revenue/Treasury group).

### The math (computed live in the browser, not stored in DB)

For every user holding:
```
Invested  = avg_buy_price × quantity (or grams)
Value     = current_price × quantity (or grams)
P/L       = Value − Invested
P/L %     = (P/L ÷ Invested) × 100
```

- **avg_buy_price** is locked in the DB row when the user buys (`gold_holdings` / `stock_holdings`).
- **current_price** comes from two live sources:
  - **Gold** → `gold-price` edge function (Swissquote → gold-api.com → static fallback), polled every 30s by `useGoldPrice`.
  - **Stocks** → `stock-price` edge function, polled every 30s by `useStockPrices`.

### What you see on screen

1. **4 summary cards (top):** platform-wide totals — Gold Invested, Gold Value (+P/L badge), Stocks Invested, Stocks Value (+P/L badge). Green = profit, red = loss.
2. **Filter bar:** search by user/phone, toggle All / Winners / Losers, sort by P/L ↑↓.
3. **Two tabs:**
   - **Gold:** every user's grams, karat, avg buy vs current ৳/g, invested, current value, P/L.
   - **Stocks:** every user's symbol, qty, avg buy vs current ৳, invested, current value, P/L.
4. **CSV export** button per tab → downloads filtered rows.

### Why it updates without refresh

- Subscribes to Postgres `*` events on `gold_holdings` and `stock_holdings` → re-fetches on any insert/update/delete (e.g. user buys/sells).
- Merges live prices from `useStockPrices` straight into table rows every 30s → P/L recalculates instantly without a DB round-trip.

### Important caveat

This is **unrealized** P/L only (paper gains/losses on currently held positions). **Realized** P/L from past sales isn't tracked because there's no `gold_trades` / `stock_trades` ledger table yet — that would be a separate feature if you want it.

### Want me to add anything?

Possible next steps: per-symbol aggregation tab (e.g. "all users holding GRPH"), realized P/L ledger, or a top movers leaderboard.


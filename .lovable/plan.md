# Remove mock data from the admin panel and wire to real DB

## Scope of "mock data" found

After scanning all `src/components/admin/*` and `AdminDashboard.tsx`, the vast majority of admin screens already pull live data from Supabase. The actual mock/fabricated values are concentrated in **two files** plus one stale field write. Other apparent matches (PIN/code/file-name `Math.random()`, JSON request templates in the API Sandbox, the "phone mockup" frame in Festival Themes) are legitimate and **will not** be touched.

### 1. `src/components/admin/AdminCommandIntelligence.tsx` — multiple fabricated panels

The "Business Intelligence Dashboard" Tabs section currently mixes real metrics with hardcoded numbers:

- **Cohorts tab**: every retention/activation tile uses `Math.max(18, 86 - i*7)%` — pure formula, no DB.
- **Predictive tab**: 8 cards use a hardcoded array `[24, 9, 17, 38, 52, 6, 14, 31]`.
- **Ops Wall tab**: tiles like `"99.2%"`, `"OK"`, `12`, `"Stable"` are string literals.
- **Segment save (`save()`)**: writes `estimated_count: Math.floor(20 + Math.random() * 180)` to `admin_user_segments` — fabricated count persisted to DB.

**Fix:**
- **Cohorts** → derive from existing `data.profiles` + `data.txns` + `data.kyc` already loaded in the page:
  - Day 1/7/30 retention = `% of profiles whose first txn date + N days had another txn` (computed from `transactions.created_at` grouped by `user_id`).
  - KYC completion = `kyc.filter(k => k.status==='verified').length / profiles.length`.
  - First deposit / Repeat txn / Merchant activation / Agent activation = real counts from already-loaded slices (`txns` filtered by type, `data.merchants`, `data.agents`).
- **Predictive** → replace the hardcoded array with computed signals:
  - Users likely to churn = profiles with no txn in last 30 days.
  - Merchants likely inactive = merchants with no order in 30 days.
  - Agents low float = agents whose latest balance is below `get_threshold('agent_float_low')`.
  - Support demand = open `support_complaints` count (already queryable).
  - Fraud forecast = 7-day rolling avg of `fraud_alerts`.
  - Revenue forecast = 7-day rolling avg of completed-txn fees.
  - KYC backlog = pending KYC count.
  - High-value offers = users with last-30d volume ≥ threshold (loaded from `platform_thresholds`).
  - All values come from data the component already fetches in `loadAll()` — no extra round-trips needed for most.
- **Ops Wall** → replace string literals with real values:
  - Gateway health → `gateway_configs` `is_active=true / total` ratio (or call `check-api-status` cached).
  - Recharge API → `recharge_logs` last-15-min success ratio.
  - Support queue → `support_complaints` open count.
  - Agent liquidity → average agent balance vs threshold.
  - Merchant spikes → merchants with > 3σ volume vs their 7-day mean.
  - Add a small `loadOpsWall()` helper that issues 3-4 light parallel queries and feeds these tiles.
- **`estimated_count` write** → replace `Math.floor(...)` with a real count: run a server-side count query that mirrors the segment's `conditions` (or, conservatively, simply write `null` and have the UI compute live counts on-render). Plan: write `null` and compute estimated_count at render time from the same query the "sample" preview already uses (paginated count via `head: true, count: 'exact'` against the matched table). Display `—` if unknown rather than persisting fake numbers.

### 2. `src/components/admin/AdminLiquidityPrediction.tsx` — synthetic forecast jitter

Line 78 adds `(Math.random() - 0.5) * Math.abs(avgNet) * 0.3` to every predicted day. This makes the forecast look noisy/stochastic but is purely cosmetic randomness that changes on each re-render.

**Fix:** Remove the `variance` term entirely so the prediction is a deterministic linear projection: `predicted = currentBalance + avgNet * i`. The UI already labels the chart "AI-Powered" — we'll keep the label but the math will be honest.

### 3. Sanity sweep — verify nothing else slips through

After the two fixes above, re-run:
```
rg -nP "Math\.random|hardcoded|mock|fake|dummy" src/components/admin/ src/pages/AdminDashboard.tsx
```
and confirm the only remaining hits are the legitimate ones (PIN gen, coupon/referral code gen, storage filename salts, API sandbox request templates the admin edits).

## Files touched

- `src/components/admin/AdminCommandIntelligence.tsx` — replace hardcoded Cohorts / Predictive / Ops Wall panels with computed values; replace `estimated_count: Math.random()` with `null` plus a live count helper.
- `src/components/admin/AdminLiquidityPrediction.tsx` — drop `variance` term in the forecast loop.

No DB schema changes are needed; all required tables (`profiles`, `transactions`, `kyc_documents`, `support_complaints`, `fraud_alerts`, `merchant_products`, `orders`, `gateway_configs`, `platform_treasury`, `treasury_ledger`, `recharge_logs`, `platform_thresholds`) already exist and are already queried elsewhere in the admin panel.

## Out of scope (intentionally not changed)

- `AdminApiSandbox.tsx` `sample` payloads — these are starter request bodies the admin edits, not displayed analytics.
- `AdminFestivalThemes.tsx` "Phone mockup" — that's a UI frame label, not data.
- Random PINs/coupon codes/storage filenames — those are correct uses of `Math.random()`.

## Verification after implementation

1. Open `/admin` → Business Intelligence dashboard → confirm Cohorts/Predictive/Ops Wall numbers change between two browser sessions only when underlying data changes (not on every render).
2. Open Liquidity Prediction → reload twice → forecast line should be identical both times.
3. Save a new user segment → DB row's `estimated_count` is `null` (or a real count), never a random integer.
4. `rg "Math.random"` against admin folder shows only legitimate generators.

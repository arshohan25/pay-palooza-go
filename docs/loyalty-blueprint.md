# EasyPay Club — Loyalty Program Blueprint (end-to-end)

Status: sections 1–7 below describe the target design **and** mark what is already
live in this codebase (`LIVE`), what is partial (`PARTIAL`), and what is not built
yet (`TODO`). Nothing here contradicts the running implementation — the numbers are
read from `loyalty_tiers`, `loyalty_tier_limits`, `loyalty_point_rules` and
`fee_config`.

---

## 1) Assumptions and scope

**Target users.** Retail wallet customers (`app_role = customer`). Agents,
merchants, distributors and SDs are explicitly **out of scope** — they earn
commission, not loyalty points, and are excluded from the customer ladder.

**Two currencies, never mixed.**
- **BDT (৳)** — real money in `profiles.balance`, moved only by
  `credit_user_balance` / `debit_user_balance`.
- **Points** — a non-monetary reward unit in `user_loyalty_points.points_balance`.
  Points are a liability, not legal tender: no P2P transfer, no cash-out,
  no expiry-free accumulation beyond the retention window.
- Conversion is one-way: **100 points = ৳10** (`POINT_VALUE_BDT = 0.1`),
  minimum 500 points, in multiples of 100.

**Limits.** Send Money is the anchor flow. Daily ceilings run
**৳150,000 (Starter) → ৳401,000 (Signature)**; monthly ceilings run
**৳1,500,000 → ৳4,005,000**. The "150k–400k month transaction range" in the brief
maps to the *daily* send ladder; monthly is 10× daily by design so a tier is
never blocked by the monthly cap before the daily one.

**Core features in scope.** Enrollment (implicit at KYC), tier progression,
earning rules, points→wallet conversion, redemption, fee discounts, limit uplift,
fraud guards, analytics, admin tooling.

**Compliance and security.**
- KYC-gated: no earning, no redemption, no uplift for `kyc_status <> 'verified'`.
- No PAN/card data touches this system — card rails stay with the PSP, so PCI
  scope stays out of the loyalty services.
- Points ledger is append-only and holds no sensitive PII (user id + amounts only).
- Data privacy: tier inputs (30-day volume, txn count, balances) are derived
  server-side; the client never sends its own eligibility numbers.
- AML: redemptions above a threshold and abnormal accrual feed `fraud_alerts`.

---

## 2) System architecture

### Service boundaries

```text
                 ┌────────────────────┐
   client ─────► │  API / RPC edge    │  (Supabase RPC + edge functions)
                 └─────────┬──────────┘
        ┌──────────────┬────┴───────┬───────────────┬──────────────┐
        ▼              ▼            ▼               ▼              ▼
   profiles/tier   earning      redemption      fraud/risk     notifications
   (eligibility)   engine       engine          engine         + analytics
        │              │            │               │              │
        └──────────────┴────► ledger / postgres ◄───┴──────────────┘
                              (single source of truth)
```

Boundaries are logical, not separate deployments: today they are Postgres
functions plus edge workers, which keeps the money path and the points path in the
**same transaction** — the property that matters most for integrity. Splitting the
earning engine into its own service is only worth it when accrual volume forces it,
and then it must move to an outbox + idempotency-key model (see §3).

### Data model overview

| Entity | Table | Purpose |
| --- | --- | --- |
| User | `profiles` | balance, KYC, phone identity |
| Tier catalogue | `loyalty_tiers` | rank, thresholds, perks (`limit_multiplier`, `fee_discount_pct`, `cashback_bonus_pct`) `LIVE` |
| User tier state | `user_loyalty` | current tier, score, admin override + expiry `LIVE` |
| Tier audit | `loyalty_tier_audit` | every promotion/demotion/override `LIVE` |
| Tier limits | `loyalty_tier_limits` | (tier × txn_type × period) → max_amount, max_count `LIVE` |
| Earning rules | `loyalty_point_rules` | (tier × txn_type) → points_per_100, min_amount `LIVE` |
| Points balance | `user_loyalty_points` | balance, lifetime_earned, lifetime_redeemed `LIVE` |
| Points ledger | `loyalty_point_ledger` | append-only accrual/redemption rows `LIVE` |
| Money ledger | `transactions` + `transaction_events` | principal, fee, commission, status `LIVE` |
| Fees | `fee_config` | banded fee per txn_type, effective-dated `LIVE` |
| Promotions | `campaigns`, `promo_codes`, `cashback_rules` | multipliers and targeted offers `PARTIAL` |
| Fraud | `fraud_alerts`, `fraud_auto_rules` | signals and automated responses `LIVE` |

### Tech stack

Current and recommended: **TypeScript/React PWA** + **Postgres (Supabase)** with
business rules as `security definer` SQL functions, **Deno edge functions** for
schedulers and third-party calls, **Postgres LISTEN/realtime** for zero-refresh
UI, **React Query** as the client cache. If accrual volume outgrows in-transaction
writes: add **Redis** for balance/limit read caching and a **queue** (SQS/PGMQ)
with an outbox table for asynchronous accrual.

---

## 3) Core domain rules

### 3.1 Earning (`LIVE` for Send Money)

`points = floor(amount / 100) * points_per_100`, awarded only when
`amount >= min_amount` (৳50) and the transaction reaches `completed`.

| Tier | Rank | Points per ৳100 sent | Fee discount | Cashback bonus | Priority support |
| --- | --- | --- | --- | --- | --- |
| Starter | 1 | 1.0 | 0% | 0% | no |
| Pro | 2 | 1.5 | 5% | +1% | no |
| Elite | 3 | 2.0 | 10% | +2% | yes |
| Prime | 4 | 2.5 | 20% | +3% | yes |
| Signature | 5 | 3.0 | 40% | +5% | yes |

Multipliers and events (`TODO`): campaign multiplier (× 1.5–3 for a window),
first-transaction bonus, referral completion bonus, streak bonus. Implement as
additional `loyalty_point_rules` rows scoped by `campaign_id` so accrual stays
one lookup; never hardcode a promo in application code.

### 3.2 Tier thresholds (`LIVE`)

Promotion requires **both** a 30-day volume floor and a lifetime transaction count
floor: Pro ৳10k / 20 txns, Elite ৳50k / 75, Prime ৳200k / 250, Signature
৳500k / 500. Evaluation is nightly plus on-transaction; demotion uses a 30-day
grace window so a quiet month does not strip perks instantly. Admin overrides in
`user_loyalty` win over computed tiers until `override_expires_at`.

### 3.3 Send Money limit ladder (`LIVE`)

| Tier | Daily max | Daily txns | Monthly max | Monthly txns |
| --- | --- | --- | --- | --- |
| Starter | ৳150,000 | 50 | ৳1,500,000 | 600 |
| Pro | ৳200,000 | 67 | ৳1,995,000 | 798 |
| Elite | ৳251,000 | 84 | ৳2,505,000 | 1,002 |
| Prime | ৳320,000 | 107 | ৳3,195,000 | 1,278 |
| Signature | ৳401,000 | 134 | ৳4,005,000 | 1,602 |

Resolution order (`get_effective_txn_limit`): **admin per-user override → loyalty
tier limit → platform default**. Enforcement is server-side inside
`transfer_money` via `enforce_txn_limit`, which raises
`LIMIT_EXCEEDED|period|kind|limit|used|remaining|tier` — the client maps that to a
localized message with the remaining headroom (`src/lib/limitErrors.ts`).

### 3.4 Fees by amount band (`LIVE`, Send Money)

| Send amount | Fee | Effective fee at Signature (40% off) |
| --- | --- | --- |
| ৳0 – ৳5,000 | **Free** | ৳0.00 |
| ৳5,000.01 – ৳50,000 | **৳3 flat** | ৳1.80 |
| ৳50,000.01 – ৳400,000 | **৳5 flat** | ৳3.00 |

Other flows: Add money, Payment, Recharge, Pay bill — **free** to the customer
(pay bill pays the agent 1.9% commission from platform share). Cash out **0.99%**,
Bank transfer **0.85%**. Agent bank transfer/receive is free by policy. Tier
`fee_discount_pct` applies to the customer-paid fee only, never to agent
commission. Fee bands are effective-dated (`effective_from`/`effective_to`) so a
price change never rewrites history.

### 3.5 Conversion and redemption (`LIVE`)

`redeem_loyalty_points(_points)`:
1. Assert caller identity and KYC.
2. Assert `_points >= 500`, `_points % 100 = 0`, `_points <= points_balance`.
3. Decrement balance and insert a negative ledger row with `balance_after`.
4. `credit_user_balance(user_id, _points * 0.1)` in the same transaction.
5. Return `{points_redeemed, cash_credited, points_balance}`.

Because steps 3–4 share one transaction, a partial redemption is impossible.
Settlement of the ৳ liability is a treasury movement recorded in
`treasury_ledger` (`TODO`: dedicated `loyalty_liability` account so finance can
reconcile outstanding points against cash).

### 3.6 Idempotency, replay protection, audit

- Every money-moving RPC takes a client-generated `reference` and rejects
  duplicates — the same pattern as `merchant_idempotency_keys`.
- Accrual is keyed by `txn_id`; a unique index on
  `loyalty_point_ledger(txn_id, kind)` makes re-delivery a no-op (`TODO` if absent).
- `balance_after` on every ledger row lets reconciliation detect any gap without
  replaying the whole history.
- `loyalty_tier_audit` and `kyc_status_audit` record who changed what, when, why.
  Admin limit edits are confirmed in a diff dialog before write.

---

## 4) MVP feature set (phases)

**MVP — done.** Implicit enrollment at KYC, Send Money accrual, points balance +
history card, redemption to wallet, tier badge and progress page, tier limit
ladder with server enforcement, admin tier/limit/points editors with validation
and audit.

**Phase 2 — next.** Accrual on cash out / pay bill / payment; campaign
multipliers and scheduled offers; targeted promos by segment
(`admin_user_segments`); fraud guards specific to loyalty (below); partner earn
API; points expiry (24 months rolling) with a 30-day warning notification.

**Phase 3 — later.** Cohort analytics (accrual vs. redemption vs. retention),
A/B experimentation on earn rates, personalized rewards from spend patterns,
nightly reconciliation exports, offline/backup batch accrual replay.

---

## 5) API surface

Public/customer (all authenticated, RLS-scoped to `auth.uid()`):

| Purpose | Current implementation | REST equivalent |
| --- | --- | --- |
| Profile / enrollment | `profiles` + KYC flow | `POST /customers`, `GET /customers/{id}` |
| Balance and tier | `user_loyalty_points`, `user_loyalty` | `GET /balances` |
| Earn (internal only) | `award_loyalty_points` (called by `transfer_money`) | `POST /earnings` |
| Redeem | `redeem_loyalty_points` | `POST /redemptions` |
| Limit status | `get_txn_limit_status` | `GET /limits` |
| Points history | `loyalty_point_ledger` | `GET /ledger` |

Admin (requires `has_role(auth.uid(),'admin')`):
`loyalty_tiers` / `loyalty_tier_limits` / `loyalty_point_rules` upserts
(`POST /admin/promotions` equivalent), `admin_set_loyalty_override`,
`admin_scheduled_reports` (`GET /reports`).

**Auth/authz.** Phone-as-email JWT session; every function is
`security definer` with `set search_path = public` and starts with an identity
assertion (`auth.uid()` or `service_role`). Roles live in `user_roles` and are
checked through `has_role` only — never from client state. `POST /earnings` is
never exposed to the client: accrual is a server-side consequence of a completed
transaction.

---

## 6) Data and security considerations

**Retention.** Points ledger 7 years (financial record). Activity logs 90 days.
Tier audit indefinite. Deleted users → `deleted_users` with points balance
snapshotted and zeroed.

**Encryption and access control.** TLS in transit, at-rest encryption at the
database layer, RLS on every table plus explicit GRANTs, no service-role key in
any client bundle, sensitive admin reads logged to
`admin_sensitive_access_logs`.

**Fraud signals.**
1. Accrual velocity far above the tier's plausible ceiling.
2. Circular sends between two accounts inflating volume (wash trading).
3. Redemption immediately followed by cash-out of the exact credited amount.
4. Many accounts, one device fingerprint, correlated accrual.
5. Tier jump without a matching KYC/volume history.

**Response playbook.** Signal → `fraud_alerts` row (severity) → auto-response by
`fraud_auto_rules`: freeze redemption only (L1), freeze accrual + redemption (L2),
lock the wallet and escalate to compliance (L3). Every automated action writes to
`fraud_auto_rule_logs` and notifies the user in-app.

**Reconciliation (daily).**
1. `sum(points_balance)` vs. `sum(lifetime_earned) - sum(lifetime_redeemed)`.
2. Per-user `balance_after` continuity check on the newest ledger row.
3. `sum(redeemed_points) * 0.1` vs. loyalty credits in `transactions`.
4. Accrual coverage: completed sends ≥ ৳50 with no ledger row → replay queue.
Discrepancies open a `treasury_reconciliation_checks` row rather than
auto-correcting.

---

## 7) Deliverables

**ERD summary.**

```text
profiles 1─1 user_loyalty ──► loyalty_tiers ──1─* loyalty_tier_limits
   │                              │
   │                              └──1─* loyalty_point_rules
   ├─1─1 user_loyalty_points
   ├─1─* loyalty_point_ledger ──*─1 transactions
   └─1─* loyalty_tier_audit
```

**Monitoring / CI-CD.** Track accrual rate, redemption rate, outstanding points
liability, `LIMIT_EXCEEDED` rate per tier, redemption failure rate, and
reconciliation drift. Alert on drift ≠ 0 and on any accrual spike > 3σ. Vitest
unit tests gate ledger labels, limit parsing, and admin validation
(`src/test/loyalty-limits.test.ts`); migrations are reviewed before apply; deploys
are preview → publish with the edge schedulers versioned alongside.

### Snippet 1 — earning (server, inside the money transaction)

```sql
-- called by transfer_money() after the debit/credit succeeds
select public.award_loyalty_points(
  _user_id  => v_sender,
  _txn_type => 'send',
  _amount   => p_amount,
  _txn_id   => v_txn_id      -- idempotency key
);
```

### Snippet 2 — redemption (client)

```ts
const res = await redeem.mutateAsync(points);   // src/hooks/use-loyalty-points.ts
toast.success(
  t("lpPointsRedeemed")
    .replace("{points}", String(res.points_redeemed))
    .replace("{cash}", res.cash_credited.toFixed(2)),
);
```

### Snippet 3 — reconciliation (nightly)

```sql
with derived as (
  select user_id, sum(points) as net
  from public.loyalty_point_ledger group by user_id
)
select p.user_id, p.points_balance, d.net
from public.user_loyalty_points p
join derived d using (user_id)
where p.points_balance <> d.net;   -- must return zero rows
```

---

## Constraints to confirm

1. **Compliance** — is Bangladesh Bank MFS reporting required for points as a
   liability, and is there a cap on non-cash rewards per customer per month?
2. **Points expiry** — 24-month rolling expiry assumed; confirm or make it
   perpetual (materially changes the liability model).
3. **Fee discount ceiling** — Signature currently pays ৳3 on a ৳400k send; confirm
   40% is the intended floor.
4. **Stack** — this blueprint keeps everything in Postgres + edge functions. Move
   to separate services only on a volume trigger; confirm that is acceptable.

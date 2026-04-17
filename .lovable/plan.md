

## Goals/DPS/Gold/Stocks — 60-day lock + history archive + live sync polish

### Requirements (restated)

1. **60-day lock on Goals**: After creating a goal, user **cannot withdraw or cancel for 60 days** — even if goal hits 100% saved before day 60.
2. **History retention**: Show withdrawn/cancelled goals (and DPS / Gold / Stocks closed positions) for **up to 12 months**, then auto-hide.
3. **Sort order**: All closed/withdrawn/cancelled items render **below** active ones in every list.
4. **Live sync**: Background realtime updates already exist — make sure UI flips instantly without manual refresh.

---

### Investigation

Live DB has `savings_goals.created_at` (good — lock anchor). No `lock_until` column needed; compute from `created_at + 60 days`. Existing `withdraw_completed_goal` RPC needs a guard.

`SavingsFlow.tsx` already lists goals but sorts by `created_at desc` regardless of status. DPS (`savings_auto_save`), Gold (`gold_holdings`), Stocks (`stock_holdings`) lists same issue. Realtime channels already wired for all four tables — instant sync is already working; only the local sort/filter logic needs updating.

---

### Changes

#### A. DB — enforce 60-day lock + auto-archive helper

**Migration** — update `withdraw_completed_goal` to reject if `now() < created_at + 60 days`:
```sql
CREATE OR REPLACE FUNCTION public.withdraw_completed_goal(p_goal_id uuid) ...
DECLARE v_lock_until timestamptz;
BEGIN
  SELECT created_at + INTERVAL '60 days' INTO v_lock_until ...;
  IF now() < v_lock_until THEN
    RAISE EXCEPTION 'Goal is locked until %', to_char(v_lock_until, 'DD Mon YYYY')
      USING ERRCODE = 'P0001';
  END IF;
  ...existing payout logic...
END;
```

Also add a similar guard to the goal **delete/cancel** path (RLS policy + a new RPC `cancel_goal(p_goal_id)` that checks lock and refunds saved_amount to wallet if any).

#### B. Frontend — `src/components/SavingsFlow.tsx`

**Lock helpers** (top of component):
```ts
const LOCK_DAYS = 60;
const HISTORY_MONTHS = 12;
const isLocked = (g) => Date.now() < new Date(g.created_at).getTime() + LOCK_DAYS * 86400_000;
const lockDaysLeft = (g) => Math.ceil((new Date(g.created_at).getTime() + LOCK_DAYS*86400_000 - Date.now())/86400_000);
const withinHistoryWindow = (closedAt) => Date.now() - new Date(closedAt).getTime() < HISTORY_MONTHS * 30 * 86400_000;
```

**List sort + filter** (Goals, DPS, Gold, Stocks tabs):
```ts
const visible = items
  .filter(g => g.status === 'active' || withinHistoryWindow(g.withdrawn_at ?? g.updated_at))
  .sort((a,b) => {
    const aActive = a.status === 'active' ? 0 : 1;
    const bActive = b.status === 'active' ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;       // active first
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
```

**Goal Detail UI**:
- If `isLocked(goal)` AND `goal.status === 'active'`:
  - Show amber lock pill: **"🔒 Locked for {N} more days"** under the header.
  - Disable Withdraw button + Cancel button with tooltip "Available after {unlockDate}".
- If `isLocked(goal)` AND goal hits 100%:
  - Replace "Withdraw to Wallet" with disabled "🔒 Withdrawable on {unlockDate}" pill.
- After 60 days: existing Withdraw flow works.

**Goal create sheet** — add a one-line disclosure under the target field:
> "Funds are locked for 60 days from creation."

**Cancel button** — wire to new `cancel_goal` RPC, show toast on lock-error.

**Empty state for history** — if no active items, but archived exist, show small section header: "Closed (last 12 months)".

#### C. DPS / Gold / Stocks — same sort + 12-month filter

Apply the same `visible` filter/sort pattern to each tab's list. No lock for these (only Goals get the 60-day lock per request — let me know if DPS should also lock).

#### D. Live sync verification

Realtime is already subscribed for `savings_goals`, `savings_auto_save`, `gold_holdings`, `stock_holdings`. Confirm each tab calls `queryClient.invalidateQueries` on `postgres_changes` event (already does). No code change needed — just verify after deploy.

---

### Files touched
- `src/components/SavingsFlow.tsx` — lock helpers, sort+filter, Goal Detail lock pill, cancel RPC wiring
- New migration — `withdraw_completed_goal` lock guard + new `cancel_goal(p_goal_id)` RPC

### Out of scope
- DPS early-exit lock (DPS has its own maturity logic — separate batch if needed)
- Backfill of pre-existing locked goals (lock is computed from `created_at`, so historical rows automatically respect it; older goals already past 60 days are unaffected)
- Pruning archived rows older than 12 months from DB (UI just hides them — DB retention handled by separate policy if desired)


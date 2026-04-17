
User reports: Dream Bike goal shows ৳2,200/৳5,000 (44%) but they say it's "completed" — likely just deposited and progress bar lags. Plus questions about post-maturity behavior for both Goals and DPS.

## Investigation needed
<lov-tool-use id="toolu_vrtx_01JGeeHNKuHfVCkWQBMbMVYP" name="code--search_files" integration-id="code" data="{\"query\": \"savings_goals\", \"include_patterns\": \"src/components/SavingsFlow.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01KGviS2Qq4QxqKrgLc1xqux" name="code--search_files" integration-id="code" data="{\"query\": \"current_amount|target_amount|matured|completed\", \"include_patterns\": \"src/components/SavingsFlow.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_0159bgGmxZ7j16sMF9nBixDP" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT column_name, data_type FROM information_schema.columns WHERE table_name='savings_goals' AND table_schema='public'\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01YKeiQYCwVAdWnkxejFNHYU" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT column_name, data_type FROM information_schema.columns WHERE table_name='auto_save_plans' AND table_schema='public'\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_014xh6DQ1pi3jdpuB6jgkS5e" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"src/components/SavingsFlow.tsx\", \"query\": \"current_amount|target_amount|savings_goals|matur|completed\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01UFRi5CLkc2Cz5auRtMMtNQ" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN ('savings_goals','auto_save_plans') AND table_schema='public' ORDER BY table_name, ordinal_position\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_011xJRqHEG75RBeUqfadDUcz" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT id, name, target_amount, saved_amount, status, updated_at FROM savings_goals ORDER BY updated_at DESC LIMIT 10\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01TyQzPQxbxMJ7VVggbvaQcE" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/SavingsFlow.tsx\", \"lines\": \"340-410\"}">
</lov-tool-use>
Found it. Dream Bike: saved=7200, target=5000, status=completed. The screenshot shows ৳2,200/৳5,000 (44%) — UI is stale because it was viewed before realtime sync, but the bigger bug is the progress bar caps wrong and there's no completed-state UI. Let me check the rendering and the savings_deposit RPC for over-deposit handling.
<lov-tool-use id="toolu_vrtx_01Q5rk1gk9yPFfDnz8hTwovn" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/SavingsFlow.tsx\", \"lines\": \"860-925\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01SoGKcgNux6DchGVsNxv86Y" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='savings_deposit'\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01KUZ6v49iYhjjNitWTEM952" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"src/components/SavingsFlow.tsx\", \"query\": \"maturity|term_months|maturity_date|matured\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01EyGKXjiwyQmGoPHbJ89Noj" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT column_name FROM information_schema.columns WHERE table_name='auto_save_plans' AND table_schema='public'\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01PHd7iGxJzxXapAyDFaqw3X" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%save%' OR table_name ILIKE '%saving%'\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01WYyxJHXz2sRK4FKe3zGXse" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT column_name, data_type FROM information_schema.columns WHERE table_name='savings_auto_save' AND table_schema='public'\"}">
</lov-tool-use>
Now I have enough context. The Dream Bike DB shows status='completed' (saved 7200/5000), but the screenshot shows ৳2,200/৳5,000 and 44%. This is a stale-cache/realtime issue. Also: progress bar reflects raw saved/target uncapped at 100% in the value text (shows 7200/5000), and once completed there's no withdraw/celebrate UX. DPS plans (`savings_auto_save`) have `ends_at` (maturity) and `settled` flag — but no automatic payout flow exists.

<lov-plan>

## Fix: Goal progress sync + add maturity/completion payout for Goals & DPS

### Root cause of "Dream Bike not updating"

Live DB: Dream Bike `saved_amount=7200, target=5000, status=completed`. Screenshot: `৳2,200 / ৳5,000, 44%`. So the row IS updated server-side — the user is looking at a stale render. Two real bugs:

1. **Realtime works for `savings_goals` events**, but `loadGoals()` is debounce-less and any `savings_deposits` insert refetches goals — **fine**. However the goal card UI has **no key on `saved_amount`** to force re-animation, and the `motion.div` width animation runs only on mount (not on `saved_amount` change), so when the value updates in-place users see the old bar fill.
2. **`saved_amount > target_amount` is allowed** by the RPC (Dream Bike now shows ৳7,200 saved on a ৳5,000 target). The card still shows raw `7200/5000` text and `100%` cap on bar — confusing. Should clamp display to target and surface the overflow as "৳2,200 bonus saved".

### What happens after a Goal is completed?

Currently: row flips to `status='completed'`, a checkmark icon shows, but the user **has no way to withdraw the money back to wallet**. Money is locked forever in the goal row. Need a **"Withdraw to Wallet"** action on completed goals.

### What happens after a DPS plan matures?

`savings_auto_save` has `ends_at` (maturity date) and `settled` (boolean) — **but no settlement RPC exists**. When `now() > ends_at`, the plan just stops accruing silently. Need a **maturity payout flow**: principal + estimated profit credited to wallet, plan marked `settled=true`, transaction recorded.

---

### The fix (3 parts)

#### Part 1 — Goal card: realtime UI sync + clamped display
**`src/components/SavingsFlow.tsx`** (around line 870–917)

- Add `key={`${goal.id}-${goal.saved_amount}`}` to the progress `motion.div` so the bar **re-animates** to the new width on every saved_amount change.
- Clamp displayed saved amount: `Math.min(saved, target)` for the `X / Y` line.
- When `saved > target`, show a small green pill "+ ৳N bonus" next to the amount.
- When `status === 'completed'`, show a **"Withdraw to Wallet"** button (emerald, full-width, below progress) that opens a small sheet → PIN → calls new RPC `withdraw_completed_goal(goal_id)`.
- When `status === 'completed'`, force `pct = 100` and bar gradient changes to celebration tone (gold→emerald).

#### Part 2 — New DB RPCs (migration)

```sql
-- Withdraw a completed goal's saved amount back to wallet
CREATE OR REPLACE FUNCTION public.withdraw_completed_goal(p_goal_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid; v_goal record; v_new_bal numeric;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_goal FROM savings_goals WHERE id=p_goal_id AND user_id=v_user FOR UPDATE;
  IF v_goal.id IS NULL THEN RAISE EXCEPTION 'Goal not found'; END IF;
  IF v_goal.status <> 'completed' THEN RAISE EXCEPTION 'Goal not completed yet'; END IF;
  IF v_goal.saved_amount <= 0 THEN RAISE EXCEPTION 'Nothing to withdraw'; END IF;

  UPDATE profiles SET balance = balance + v_goal.saved_amount
    WHERE user_id=v_user RETURNING balance INTO v_new_bal;
  UPDATE savings_goals SET saved_amount=0, status='withdrawn', updated_at=now()
    WHERE id=p_goal_id;
  INSERT INTO transactions(user_id,type,amount,fee,balance_after,description,reference,status,short_id)
    VALUES (v_user,'addmoney',v_goal.saved_amount,0,v_new_bal,
            'Goal Withdrawal: '||v_goal.name,
            'GOAL-WD-'||upper(substring(gen_random_uuid()::text,1,8)),
            'completed', upper(substring(gen_random_uuid()::text,1,12)));
  RETURN json_build_object('success',true,'amount',v_goal.saved_amount,'balance',v_new_bal);
END $$;

-- Settle a matured DPS plan: pay back principal + flat 5% profit (Sharia: profit-share, not interest)
CREATE OR REPLACE FUNCTION public.settle_matured_dps(p_plan_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid; v_p record; v_principal numeric; v_profit numeric; v_total numeric; v_new_bal numeric;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_p FROM savings_auto_save WHERE id=p_plan_id AND user_id=v_user FOR UPDATE;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'Plan not found'; END IF;
  IF v_p.settled THEN RAISE EXCEPTION 'Plan already settled'; END IF;
  IF v_p.ends_at IS NULL OR v_p.ends_at > now() THEN RAISE EXCEPTION 'Plan not matured yet'; END IF;

  v_principal := COALESCE(v_p.amount,0) * COALESCE(v_p.total_paid,0);
  v_profit := round(v_principal * 0.05, 2); -- 5% Sharia profit-share
  v_total := v_principal + v_profit;

  UPDATE profiles SET balance = balance + v_total
    WHERE user_id=v_user RETURNING balance INTO v_new_bal;
  UPDATE savings_auto_save SET settled=true, is_active=false, updated_at=now() WHERE id=p_plan_id;
  INSERT INTO transactions(user_id,type,amount,fee,balance_after,description,reference,status,short_id)
    VALUES (v_user,'addmoney',v_total,0,v_new_bal,
            'DPS Maturity Payout (incl. ৳'||v_profit||' profit)',
            'DPS-MAT-'||upper(substring(gen_random_uuid()::text,1,8)),
            'completed', upper(substring(gen_random_uuid()::text,1,12)));
  RETURN json_build_object('success',true,'principal',v_principal,'profit',v_profit,'total',v_total,'balance',v_new_bal);
END $$;
```

#### Part 3 — DPS plan card: maturity action
**`src/components/SavingsFlow.tsx`** (active plans drawer / list)

- For each `autoSaves` row, compute `isMatured = ends_at && new Date(ends_at) <= now`.
- If `isMatured && !settled` → show a glowing emerald **"Claim Maturity Payout"** banner showing principal + estimated 5% profit + total. Tap → PIN sheet → `settle_matured_dps(plan_id)` → confetti + toast `🎉 ৳X credited to wallet`.
- If `settled` → row shows "Matured & paid out" badge.

### What user sees after fix
- **Goal completed**: bar pulses to 100%, golden ring, "Withdraw ৳X to Wallet" CTA.
- **DPS matured**: orange "Claim Now" banner on the plan, one-tap settles to wallet with profit.
- **Stale Dream Bike**: progress bar re-animates the moment `saved_amount` changes via realtime (no refresh needed).

### Files touched
- New migration — adds `withdraw_completed_goal` + `settle_matured_dps` RPCs
- `src/components/SavingsFlow.tsx` — goal card (clamp + withdraw button + animated key); DPS card (maturity claim banner)

### Out of scope
- No fee on withdrawals (full principal returned)
- Profit % is fixed flat 5% — future iteration can read from `fee_config`
- No UI redesign of other tabs


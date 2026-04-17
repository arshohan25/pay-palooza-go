
## Real Data Issues in AdminUserMetrics — Findings & Fixes

### Bugs found by querying the actual DB

| Card | Current query | Reality | Fix |
|---|---|---|---|
| **Coupons Used** | `transactions.metadata->>coupon_code` | `transactions` has **no metadata column** → 400 error → shows 0 | Use `coupons.used_count` SUM, or count `orders` with non-null coupon, or just sum `coupons.used_count` |
| **Send Money / Cash Out / Cash In / Add Money / Payment / Recharge / Bill Pay / Bank Transfer (30d)** | filters `type = 'send' / 'cashout' / 'cashin' / 'addmoney' / 'payment' / 'recharge' / 'paybill' / 'banktransfer'` | DB has these EXACT values ✅ — these are correct | No change |
| **Inactive 30d / Dormant 90d** | fetches ALL profiles with `created_at < day30` then ALL active txns, computes diff in JS | **1000-row Supabase limit** silently caps both queries; numbers will undercount on large datasets | Replace with a single SQL RPC that returns the count, OR use `.select('user_id', { count: 'exact', head: true })` patterns. For now: add `.limit(50000)` + `head:false` and document the cap. |
| **DAU / WAU / MAU** | same pattern — fetches all `user_id` rows then `new Set().size` | Hits 1000-row cap | Same fix — use a SECURITY DEFINER RPC `admin_distinct_active_users(window interval)` |
| **Avg Balance** | fetches all `profiles.balance` then averages in JS | Hits 1000-row cap | Use `rpc('admin_avg_balance')` or accept the cap with a note |
| **Total Users / Active / Suspended / New today/7d/30d** | uses `count: exact, head: true` | ✅ Accurate | No change |
| **KYC Verified/Pending/Rejected** | counts `kyc_verifications` rows | Counts **rows, not users** — a user can have multiple submissions; my probe showed 2 rows for the same user | Use `COUNT(DISTINCT user_id)` via RPC, OR query `profiles` joined to latest kyc per user |
| **Devices / PIN Changes / Fraud Alerts / Disputes / Feature Locks / Referrals / AI Rewards** | direct `count: exact` on table | ✅ Accurate | No change |
| **Shop Orders / Gift Cards / Donations / Savings (Gold)** | direct `count: exact` on table | ✅ Accurate | No change |

### Fix Plan

**1. Create one SECURITY DEFINER RPC** in a migration to bypass the 1000-row cap and give exact aggregates:

```sql
create or replace function public.admin_user_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if not has_role(auth.uid(), 'admin') then
    raise exception 'forbidden';
  end if;
  select jsonb_build_object(
    'dau',           (select count(distinct user_id) from transactions where created_at >= now() - interval '1 day'),
    'wau',           (select count(distinct user_id) from transactions where created_at >= now() - interval '7 days'),
    'mau',           (select count(distinct user_id) from transactions where created_at >= now() - interval '30 days'),
    'inactive_30d',  (select count(*) from profiles p where p.phone not like 'staff-%' and p.created_at < now() - interval '30 days' and not exists (select 1 from transactions t where t.user_id = p.user_id and t.created_at >= now() - interval '30 days')),
    'dormant_90d',   (select count(*) from profiles p where p.phone not like 'staff-%' and p.created_at < now() - interval '90 days' and not exists (select 1 from transactions t where t.user_id = p.user_id and t.created_at >= now() - interval '90 days')),
    'avg_balance',   (select coalesce(round(avg(balance))::int, 0) from profiles where phone not like 'staff-%'),
    'kyc_verified',  (select count(distinct user_id) from kyc_verifications where status='approved'),
    'kyc_pending',   (select count(distinct user_id) from kyc_verifications where status='pending'),
    'kyc_rejected',  (select count(distinct user_id) from kyc_verifications where status='rejected'),
    'coupons_used',  (select coalesce(sum(used_count),0) from coupons)
  ) into result;
  return result;
end $$;

grant execute on function public.admin_user_metrics() to authenticated;
```

**2. Update `src/components/admin/AdminUserMetrics.tsx`**:
- Call the RPC once for the aggregates above (replaces ~10 queries that were either broken or capped)
- Keep the simple `count: exact, head: true` queries that already work
- Remove the broken `metadata->>coupon_code` query

### Files Touched

- **New migration** — adds `admin_user_metrics()` RPC
- **`src/components/admin/AdminUserMetrics.tsx`** — replace broken/capped queries with the single RPC call

### Out of Scope
- No UI/aesthetic changes
- No changes to clickable filter routing (already working)
- No new metrics added — only fixing the wrong numbers

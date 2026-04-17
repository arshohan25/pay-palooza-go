
The user reports the "Inactive 30d" (and likely "Dormant 90d") cards show wrong numbers vs real data. Let me think through what could be wrong with the RPC.

Current RPC logic:
```sql
'inactive_30d', (select count(*) from profiles p 
  where p.phone not like 'staff-%' 
  and p.created_at < now() - interval '30 days' 
  and not exists (select 1 from transactions t where t.user_id = p.user_id and t.created_at >= now() - interval '30 days'))
```

Likely issues:
1. **`p.created_at < now() - interval '30 days'` excludes recent users** — a user who signed up 10 days ago and never transacted is "inactive" but won't be counted. The Inactive card should mean "users with no activity in the last 30 days" regardless of signup date, OR at minimum include all users who existed at the start of the window.
2. **No filter on profile status** — suspended/deleted users get counted as "inactive."
3. The frontend card label says "Inactive 30d" but the user expectation is "users who haven't transacted in 30 days" — should include everyone (minus staff, minus suspended).
4. Same logic issue applies to `dormant_90d`.

Also worth checking via DB probe:
- Total non-staff profiles count
- DAU/WAU/MAU numbers vs Inactive — they should add up sensibly (active in 30d + inactive 30d ≈ total)

### Plan

**1. Fix the RPC** (`supabase/migrations/...new.sql`) — replace the inactive/dormant calculations:

```sql
'inactive_30d', (
  select count(*) from profiles p 
  where p.phone not like 'staff-%' 
  and coalesce(p.status,'active') = 'active'
  and not exists (
    select 1 from transactions t 
    where t.user_id = p.user_id 
    and t.created_at >= now() - interval '30 days'
  )
),
'dormant_90d', (
  select count(*) from profiles p 
  where p.phone not like 'staff-%' 
  and coalesce(p.status,'active') = 'active'
  and not exists (
    select 1 from transactions t 
    where t.user_id = p.user_id 
    and t.created_at >= now() - interval '90 days'
  )
),
```

Changes:
- Remove the `created_at < now() - interval '30 days'` gate so newly-signed-up but inactive users are counted
- Add `status = 'active'` so suspended users aren't double-counted in both "Suspended" and "Inactive"

**2. Update the card hint** in `AdminUserMetrics.tsx` so the meaning is unambiguous:
- "Inactive 30d" → hint: "No txn in 30d"
- "Dormant 90d" → hint: "No txn in 90d"

**3. Verify with a quick DB probe** before committing — confirm:
- Total non-staff active users
- MAU count
- New inactive count (should equal total active non-staff − MAU)

### Files Touched
- New migration to `CREATE OR REPLACE` the `admin_user_metrics()` function
- `src/components/admin/AdminUserMetrics.tsx` — minor hint text update only

### Out of Scope
- No UI/aesthetic changes
- No changes to other metrics (those are accurate)
- No changes to clickable filtering

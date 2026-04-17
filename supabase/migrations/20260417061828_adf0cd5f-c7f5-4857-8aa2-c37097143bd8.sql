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
    'inactive_30d',  (select count(*) from profiles p where p.phone not like 'staff-%' and coalesce(p.status,'active') = 'active' and not exists (select 1 from transactions t where t.user_id = p.user_id and t.created_at >= now() - interval '30 days')),
    'dormant_90d',   (select count(*) from profiles p where p.phone not like 'staff-%' and coalesce(p.status,'active') = 'active' and not exists (select 1 from transactions t where t.user_id = p.user_id and t.created_at >= now() - interval '90 days')),
    'avg_balance',   (select coalesce(round(avg(balance))::int, 0) from profiles where phone not like 'staff-%'),
    'kyc_verified',  (select count(distinct user_id) from kyc_verifications where status='approved'),
    'kyc_pending',   (select count(distinct user_id) from kyc_verifications where status='pending'),
    'kyc_rejected',  (select count(distinct user_id) from kyc_verifications where status='rejected'),
    'coupons_used',  (select coalesce(sum(used_count),0)::bigint from coupons)
  ) into result;
  return result;
end $$;

grant execute on function public.admin_user_metrics() to authenticated;
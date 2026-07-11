
CREATE OR REPLACE FUNCTION public.get_agent_customer_kyc(_agent_id uuid)
RETURNS TABLE (
  user_id uuid,
  name text,
  phone text,
  status text,
  rejection_reason text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.name,
    p.phone,
    COALESCE(latest.status, 'none') AS status,
    CASE WHEN latest.status = 'rejected' THEN latest.reviewer_notes ELSE NULL END AS rejection_reason,
    COALESCE(latest.updated_at, r.created_at) AS updated_at
  FROM public.referrals r
  JOIN public.profiles p ON p.user_id = r.referee_id
  LEFT JOIN LATERAL (
    SELECT k.status, k.reviewer_notes, k.updated_at
    FROM public.kyc_verifications k
    WHERE k.user_id = r.referee_id
    ORDER BY k.created_at DESC
    LIMIT 1
  ) latest ON TRUE
  WHERE r.referrer_id = _agent_id
    AND (_agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_customer_kyc(uuid) TO authenticated;

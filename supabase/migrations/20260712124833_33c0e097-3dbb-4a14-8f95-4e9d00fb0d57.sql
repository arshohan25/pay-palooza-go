-- Track every status change on kyc_verifications so agents can see
-- who updated a customer's KYC and when, plus the previous/new status.

CREATE TABLE public.kyc_status_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kyc_verification_id UUID NOT NULL REFERENCES public.kyc_verifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,                    -- the customer whose KYC changed
  agent_id UUID,                            -- agent who onboarded the customer (if any)
  changed_by UUID,                          -- admin/reviewer who performed the change
  changed_by_role TEXT,                     -- 'admin' | 'agent' | 'system' | NULL
  previous_status TEXT,
  new_status TEXT NOT NULL,
  reviewer_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_kyc_status_audit_user_id ON public.kyc_status_audit(user_id, created_at DESC);
CREATE INDEX idx_kyc_status_audit_agent_id ON public.kyc_status_audit(agent_id, created_at DESC);

GRANT SELECT ON public.kyc_status_audit TO authenticated;
GRANT ALL ON public.kyc_status_audit TO service_role;

ALTER TABLE public.kyc_status_audit ENABLE ROW LEVEL SECURITY;

-- The customer can read their own audit trail.
CREATE POLICY "Customers can view their own KYC audit"
  ON public.kyc_status_audit
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- The agent who onboarded this customer can read the audit.
CREATE POLICY "Agents can view audit for their onboarded customers"
  ON public.kyc_status_audit
  FOR SELECT
  TO authenticated
  USING (auth.uid() = agent_id);

-- Admins can read all audit rows.
CREATE POLICY "Admins can view all KYC audit rows"
  ON public.kyc_status_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger: whenever kyc_verifications.status changes (or a row is inserted
-- with a non-null status), log a row into kyc_status_audit.
CREATE OR REPLACE FUNCTION public.log_kyc_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id UUID;
  v_role TEXT;
  v_actor UUID;
BEGIN
  -- Only log when the status actually changes (or on INSERT with a status).
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Best-effort: find the agent who onboarded this customer via the
  -- referrals table (referrer_id = agent, referred_id = customer).
  SELECT referrer_id INTO v_agent_id
  FROM public.referrals
  WHERE referred_id = NEW.user_id
  LIMIT 1;

  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    v_role := 'system';
  ELSIF public.has_role(v_actor, 'admin') THEN
    v_role := 'admin';
  ELSIF v_actor = v_agent_id THEN
    v_role := 'agent';
  ELSE
    v_role := 'user';
  END IF;

  INSERT INTO public.kyc_status_audit(
    kyc_verification_id, user_id, agent_id, changed_by, changed_by_role,
    previous_status, new_status, reviewer_notes
  ) VALUES (
    NEW.id,
    NEW.user_id,
    v_agent_id,
    v_actor,
    v_role,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
    NEW.status,
    NEW.reviewer_notes
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_kyc_status_change ON public.kyc_verifications;
CREATE TRIGGER trg_log_kyc_status_change
AFTER INSERT OR UPDATE OF status ON public.kyc_verifications
FOR EACH ROW EXECUTE FUNCTION public.log_kyc_status_change();

-- RPC: agent-scoped audit feed. Returns the recent status changes for
-- customers this agent onboarded, joined with the customer's name/phone.
CREATE OR REPLACE FUNCTION public.get_agent_kyc_audit(_agent_id UUID, _limit INT DEFAULT 25)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  customer_name TEXT,
  customer_phone TEXT,
  previous_status TEXT,
  new_status TEXT,
  reviewer_notes TEXT,
  changed_by UUID,
  changed_by_role TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.user_id,
    p.name AS customer_name,
    p.phone AS customer_phone,
    a.previous_status,
    a.new_status,
    a.reviewer_notes,
    a.changed_by,
    a.changed_by_role,
    a.created_at
  FROM public.kyc_status_audit a
  LEFT JOIN public.profiles p ON p.user_id = a.user_id
  WHERE a.agent_id = _agent_id
    -- Enforce: caller must be the requested agent OR an admin.
    AND (auth.uid() = _agent_id OR public.has_role(auth.uid(), 'admin'))
  ORDER BY a.created_at DESC
  LIMIT COALESCE(_limit, 25);
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_kyc_audit(UUID, INT) TO authenticated;
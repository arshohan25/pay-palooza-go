
CREATE TABLE public.agent_float_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  agent_user_id uuid NOT NULL,
  distributor_id uuid REFERENCES public.distributors(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  decided_by uuid,
  decided_at timestamptz,
  txn_reference text,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_afr_distributor_status ON public.agent_float_requests(distributor_id, status);
CREATE INDEX idx_afr_agent ON public.agent_float_requests(agent_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.agent_float_requests TO authenticated;
GRANT ALL ON public.agent_float_requests TO service_role;

ALTER TABLE public.agent_float_requests ENABLE ROW LEVEL SECURITY;

-- Agents view their own requests
CREATE POLICY "agents_view_own_float_requests" ON public.agent_float_requests
  FOR SELECT TO authenticated
  USING (agent_user_id = auth.uid());

-- Agents create their own requests
CREATE POLICY "agents_insert_own_float_requests" ON public.agent_float_requests
  FOR INSERT TO authenticated
  WITH CHECK (agent_user_id = auth.uid() AND status = 'pending');

-- Agents can cancel their own pending requests
CREATE POLICY "agents_cancel_own_float_requests" ON public.agent_float_requests
  FOR UPDATE TO authenticated
  USING (agent_user_id = auth.uid() AND status = 'pending')
  WITH CHECK (agent_user_id = auth.uid() AND status IN ('pending','cancelled'));

-- Distributor sees requests for their agents
CREATE POLICY "distributors_view_agent_float_requests" ON public.agent_float_requests
  FOR SELECT TO authenticated
  USING (
    distributor_id IN (SELECT id FROM public.distributors WHERE user_id = auth.uid())
  );

-- Distributor updates (approve/reject) for their agents
CREATE POLICY "distributors_update_agent_float_requests" ON public.agent_float_requests
  FOR UPDATE TO authenticated
  USING (
    distributor_id IN (SELECT id FROM public.distributors WHERE user_id = auth.uid())
  )
  WITH CHECK (
    distributor_id IN (SELECT id FROM public.distributors WHERE user_id = auth.uid())
  );

-- Admins full access
CREATE POLICY "admins_all_float_requests" ON public.agent_float_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_afr_updated_at
  BEFORE UPDATE ON public.agent_float_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

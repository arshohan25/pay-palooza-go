
CREATE TABLE public.user_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type text NOT NULL,
  reward_value jsonb NOT NULL DEFAULT '{}',
  reason text,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access on user_rewards"
  ON public.user_rewards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read own rewards"
  ON public.user_rewards FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_user_rewards_user_id ON public.user_rewards(user_id);
CREATE INDEX idx_user_rewards_status ON public.user_rewards(status);


CREATE TABLE public.ai_auto_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reward_type TEXT NOT NULL DEFAULT 'coupon',
  title TEXT NOT NULL,
  description TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  segment TEXT,
  expires_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_auto_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rewards"
  ON public.ai_auto_rewards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all rewards"
  ON public.ai_auto_rewards FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_ai_auto_rewards_user ON public.ai_auto_rewards(user_id);
CREATE INDEX idx_ai_auto_rewards_status ON public.ai_auto_rewards(status);

ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_auto_rewards;

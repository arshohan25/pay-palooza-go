
CREATE TABLE public.pin_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  change_type TEXT NOT NULL DEFAULT 'self_change',
  method TEXT NOT NULL DEFAULT 'manual',
  changed_by UUID,
  device_info TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pin_change_history_user ON public.pin_change_history(user_id, created_at DESC);

ALTER TABLE public.pin_change_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own PIN history"
  ON public.pin_change_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all PIN history"
  ON public.pin_change_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

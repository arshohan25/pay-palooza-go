
-- Feature locks table: admins can lock specific features for specific users
CREATE TABLE public.feature_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL,
  feature TEXT NOT NULL,
  reason TEXT,
  locked_by UUID NOT NULL,
  locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL = permanent
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_feature_locks_target ON public.feature_locks (target_user_id, feature, is_active);

-- Enable RLS
ALTER TABLE public.feature_locks ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage feature locks"
ON public.feature_locks
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own locks
CREATE POLICY "Users can view own locks"
ON public.feature_locks
FOR SELECT
USING (auth.uid() = target_user_id);

-- Trigger for updated_at
CREATE TRIGGER update_feature_locks_updated_at
BEFORE UPDATE ON public.feature_locks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.feature_locks;


-- Create user_feature_overrides table
CREATE TABLE public.user_feature_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  visibility text NOT NULL DEFAULT 'visible' CHECK (visibility IN ('visible', 'disabled', 'hidden')),
  group_type text CHECK (group_type IN ('usage_badge', 'role')),
  group_value text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature_key) -- for user-specific overrides
);

-- Index for fast lookups
CREATE INDEX idx_ufo_user ON public.user_feature_overrides(user_id);
CREATE INDEX idx_ufo_group ON public.user_feature_overrides(group_type, group_value);
CREATE INDEX idx_ufo_feature ON public.user_feature_overrides(feature_key);

-- RLS
ALTER TABLE public.user_feature_overrides ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admins manage user feature overrides"
ON public.user_feature_overrides
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can read their own overrides + group overrides
CREATE POLICY "Users read own and group overrides"
ON public.user_feature_overrides
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL);

-- Function to compute usage badge
CREATE OR REPLACE FUNCTION public.get_user_usage_badge(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created_at timestamptz;
  v_days int;
  v_txn_count int;
BEGIN
  SELECT created_at INTO v_created_at FROM profiles WHERE id = p_user_id;
  IF v_created_at IS NULL THEN RETURN 'new'; END IF;
  
  v_days := EXTRACT(DAY FROM (now() - v_created_at));
  
  SELECT count(*) INTO v_txn_count FROM transactions WHERE user_id = p_user_id AND status = 'completed';
  
  IF v_days >= 90 AND v_txn_count >= 50 THEN RETURN 'power';
  ELSIF v_days >= 30 OR v_txn_count >= 10 THEN RETURN 'active';
  ELSIF v_days >= 7 THEN RETURN 'basic';
  ELSE RETURN 'new';
  END IF;
END;
$$;

-- Function to resolve feature visibility for a user
CREATE OR REPLACE FUNCTION public.get_user_feature_visibility(p_user_id uuid, p_feature_key text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vis text;
  v_badge text;
BEGIN
  -- 1. Check user-specific override
  SELECT visibility INTO v_vis
  FROM user_feature_overrides
  WHERE user_id = p_user_id AND feature_key = p_feature_key
  LIMIT 1;
  IF v_vis IS NOT NULL THEN RETURN v_vis; END IF;

  -- 2. Check group overrides (usage_badge)
  v_badge := get_user_usage_badge(p_user_id);
  SELECT visibility INTO v_vis
  FROM user_feature_overrides
  WHERE user_id IS NULL AND group_type = 'usage_badge' AND group_value = v_badge AND feature_key = p_feature_key
  LIMIT 1;
  IF v_vis IS NOT NULL THEN RETURN v_vis; END IF;

  -- 3. Check role-based group overrides
  SELECT ufo.visibility INTO v_vis
  FROM user_feature_overrides ufo
  JOIN user_roles ur ON ur.role::text = ufo.group_value
  WHERE ufo.user_id IS NULL AND ufo.group_type = 'role' AND ur.user_id = p_user_id AND ufo.feature_key = p_feature_key
  LIMIT 1;
  IF v_vis IS NOT NULL THEN RETURN v_vis; END IF;

  -- 4. Fall back to global toggle
  SELECT visibility INTO v_vis
  FROM global_feature_toggles
  WHERE feature_key = p_feature_key
  LIMIT 1;
  
  RETURN COALESCE(v_vis, 'visible');
END;
$$;

-- Insert default rules: hide certain features for "new" users
INSERT INTO public.user_feature_overrides (user_id, feature_key, visibility, group_type, group_value) VALUES
  (NULL, 'account_icon_size', 'hidden', 'usage_badge', 'new'),
  (NULL, 'account_grid_layout', 'hidden', 'usage_badge', 'new'),
  (NULL, 'account_compact_mode', 'hidden', 'usage_badge', 'new'),
  (NULL, 'account_onboarding', 'hidden', 'usage_badge', 'new'),
  (NULL, 'account_become_merchant', 'hidden', 'usage_badge', 'new'),
  (NULL, 'account_live_chat', 'hidden', 'usage_badge', 'new');

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_feature_overrides;

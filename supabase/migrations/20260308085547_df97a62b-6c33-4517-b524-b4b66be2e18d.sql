
CREATE TABLE public.user_quick_action_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_order text[] NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_quick_action_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own order"
  ON public.user_quick_action_order
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own order"
  ON public.user_quick_action_order
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own order"
  ON public.user_quick_action_order
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

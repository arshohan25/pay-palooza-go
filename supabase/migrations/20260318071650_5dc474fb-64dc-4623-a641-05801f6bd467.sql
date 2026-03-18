
CREATE TABLE public.recurring_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cause_name text NOT NULL,
  cause_icon text,
  amount numeric NOT NULL CHECK (amount > 0),
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  message text,
  is_anonymous boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  next_run_at timestamptz NOT NULL,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recurring donations"
  ON public.recurring_donations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own recurring donations"
  ON public.recurring_donations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own recurring donations"
  ON public.recurring_donations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own recurring donations"
  ON public.recurring_donations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all recurring donations"
  ON public.recurring_donations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

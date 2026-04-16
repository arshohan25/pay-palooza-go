
-- Add DPS tracking columns to savings_auto_save
ALTER TABLE public.savings_auto_save 
  ADD COLUMN IF NOT EXISTS missed_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_paid integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_installments integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS strategy text DEFAULT 'gold',
  ADD COLUMN IF NOT EXISTS last_missed_at timestamptz;

-- Create dps_missed_payments table
CREATE TABLE public.dps_missed_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES public.savings_auto_save(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  due_date timestamptz NOT NULL,
  repaid boolean DEFAULT false,
  repaid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dps_missed_payments ENABLE ROW LEVEL SECURITY;

-- Users can manage their own missed payments
CREATE POLICY "Users manage own missed payments" ON public.dps_missed_payments
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.dps_missed_payments;

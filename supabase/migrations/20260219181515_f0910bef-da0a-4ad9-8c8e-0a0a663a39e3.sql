
-- Create transaction type enum
CREATE TYPE public.txn_type AS ENUM ('send', 'cashout', 'payment', 'recharge', 'paybill', 'addmoney');

-- Create transaction status enum
CREATE TYPE public.txn_status AS ENUM ('pending', 'completed', 'failed', 'reversed');

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type txn_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  fee NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  recipient_phone TEXT,
  recipient_name TEXT,
  description TEXT,
  reference TEXT,
  status txn_status NOT NULL DEFAULT 'completed',
  balance_after NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users can only view their own transactions
CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own transactions
CREATE POLICY "Users can create own transactions"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX idx_transactions_type ON public.transactions(type);

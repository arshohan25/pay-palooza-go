
-- Add banktransfer enum value
ALTER TYPE public.txn_type ADD VALUE 'banktransfer';

-- Create saved_bank_accounts table
CREATE TABLE public.saved_bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  short_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, bank_name, account_number)
);

-- Enable RLS
ALTER TABLE public.saved_bank_accounts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own saved accounts
CREATE POLICY "Users can view own saved accounts"
ON public.saved_bank_accounts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved accounts"
ON public.saved_bank_accounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved accounts"
ON public.saved_bank_accounts FOR DELETE
USING (auth.uid() = user_id);

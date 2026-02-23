
-- Create payment_sessions table to track pending gateway payments
CREATE TABLE public.payment_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL, -- 'bkash', 'nagad', etc.
  amount NUMERIC NOT NULL,
  fee NUMERIC NOT NULL DEFAULT 0,
  provider_payment_id TEXT, -- bKash paymentID or Nagad payment ref
  provider_trx_id TEXT, -- final transaction ID from provider
  callback_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed, expired
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.payment_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "Users can view own payment sessions"
ON public.payment_sessions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own sessions
CREATE POLICY "Users can create own payment sessions"
ON public.payment_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- System (service role) updates via edge functions - no user-level update policy needed
-- Edge functions use service role key

-- Enable realtime for status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_sessions;

-- Trigger for updated_at
CREATE TRIGGER update_payment_sessions_updated_at
BEFORE UPDATE ON public.payment_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- Create dispute status enum
CREATE TYPE public.dispute_status AS ENUM ('open', 'under_review', 'resolved', 'rejected');

-- Create disputes table for dispute resolution
CREATE TABLE public.disputes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES public.transactions(id),
  complainant_id UUID NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  status dispute_status NOT NULL DEFAULT 'open',
  assigned_to UUID,
  resolution_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Users can view their own disputes
CREATE POLICY "Users can view own disputes"
ON public.disputes
FOR SELECT
USING (auth.uid() = complainant_id);

-- Users can create disputes
CREATE POLICY "Users can create disputes"
ON public.disputes
FOR INSERT
WITH CHECK (auth.uid() = complainant_id);

-- Admins can manage all disputes
CREATE POLICY "Admins can manage all disputes"
ON public.disputes
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_disputes_updated_at
BEFORE UPDATE ON public.disputes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

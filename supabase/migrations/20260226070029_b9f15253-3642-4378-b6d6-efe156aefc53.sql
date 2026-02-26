
-- KYC verifications table
CREATE TABLE public.kyc_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, under_review, verified, rejected
  nid_number TEXT,
  full_name TEXT,
  date_of_birth TEXT,
  nid_front_url TEXT,
  nid_back_url TEXT,
  nid_photo_url TEXT, -- extracted face from NID
  selfie_url TEXT,    -- live selfie capture
  face_match_score NUMERIC,
  face_match_result TEXT, -- match, no_match, inconclusive
  ocr_raw_data JSONB DEFAULT '{}',
  reviewer_id UUID,
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;

-- Users can view own KYC
CREATE POLICY "Users can view own kyc" ON public.kyc_verifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create own KYC
CREATE POLICY "Users can create own kyc" ON public.kyc_verifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update own pending KYC
CREATE POLICY "Users can update own pending kyc" ON public.kyc_verifications
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- Admins can manage all KYC
CREATE POLICY "Admins can manage all kyc" ON public.kyc_verifications
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Compliance can view all KYC
CREATE POLICY "Compliance can view all kyc" ON public.kyc_verifications
  FOR SELECT USING (has_role(auth.uid(), 'compliance'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_kyc_updated_at
  BEFORE UPDATE ON public.kyc_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for KYC documents
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false);

-- Storage policies: users can upload to own folder
CREATE POLICY "Users can upload own kyc docs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own kyc docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admins can view all kyc docs
CREATE POLICY "Admins can view all kyc docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'kyc-documents' AND has_role(auth.uid(), 'admin'::app_role));

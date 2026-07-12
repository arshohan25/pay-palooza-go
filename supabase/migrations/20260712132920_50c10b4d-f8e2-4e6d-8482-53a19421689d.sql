-- Bug: kyc_exempt column defaulted to TRUE, so every new signup bypassed KYC.
ALTER TABLE public.profiles ALTER COLUMN kyc_exempt SET DEFAULT false;

-- Reset accidentally-exempted users. Admins can re-exempt individually if needed.
UPDATE public.profiles SET kyc_exempt = false WHERE kyc_exempt = true;
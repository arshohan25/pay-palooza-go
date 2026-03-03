
-- Drop the unique NID restriction
DROP INDEX IF EXISTS idx_kyc_unique_verified_nid;

-- Drop the face match validation trigger
DROP TRIGGER IF EXISTS trg_validate_kyc_face_match ON public.kyc_verifications;
DROP FUNCTION IF EXISTS public.validate_kyc_face_match();

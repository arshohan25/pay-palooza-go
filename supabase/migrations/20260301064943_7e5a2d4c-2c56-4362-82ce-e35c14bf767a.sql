-- Unique constraint: only one verified KYC per NID number
-- Using a partial unique index so only 'verified' records are constrained
CREATE UNIQUE INDEX idx_kyc_unique_verified_nid 
ON public.kyc_verifications (nid_number) 
WHERE status = 'verified' AND nid_number IS NOT NULL;

-- Validation trigger: reject KYC approval if face_match_score < 70
CREATE OR REPLACE FUNCTION public.validate_kyc_face_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Only enforce on status change to 'verified'
  IF NEW.status = 'verified' AND (OLD.status IS DISTINCT FROM 'verified') THEN
    IF NEW.face_match_score IS NULL OR NEW.face_match_score < 70 THEN
      RAISE EXCEPTION 'Cannot verify KYC: face match score must be at least 70%%. Current score: %', COALESCE(NEW.face_match_score::text, 'N/A');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_kyc_face_match
BEFORE UPDATE ON public.kyc_verifications
FOR EACH ROW
EXECUTE FUNCTION public.validate_kyc_face_match();
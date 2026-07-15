ALTER TABLE public.agents 
  ADD COLUMN IF NOT EXISTS nid_image_path TEXT,
  ADD COLUMN IF NOT EXISTS selfie_path TEXT;
-- 1) Add attachment columns to merchant PIN-reset chat messages
ALTER TABLE public.merchant_pin_reset_messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_mime text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_size integer;

-- 2) Create private bucket for PIN-reset chat attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pin-reset-attachments',
  'pin-reset-attachments',
  false,
  5242880, -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3) RLS on storage.objects: deny everything for this bucket to anon/authenticated.
--    Only the service role (used by edge functions) can read/write — they bypass RLS.
--    Both merchants (guest, OTP-verified) and admins access via signed URLs minted server-side.
DROP POLICY IF EXISTS "pin_reset_attachments_no_public_select" ON storage.objects;
DROP POLICY IF EXISTS "pin_reset_attachments_no_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "pin_reset_attachments_no_public_update" ON storage.objects;
DROP POLICY IF EXISTS "pin_reset_attachments_no_public_delete" ON storage.objects;

-- (No permissive policies are created — absence of a policy + RLS enabled = denied for anon/auth.)


-- Add soft-delete columns to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_deletion_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_by uuid;

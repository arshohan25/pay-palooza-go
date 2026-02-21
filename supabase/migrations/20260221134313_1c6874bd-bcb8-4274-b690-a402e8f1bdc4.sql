-- Add status column to profiles (reuse agent_status enum which has 'active'/'suspended')
ALTER TABLE public.profiles ADD COLUMN status text NOT NULL DEFAULT 'active';

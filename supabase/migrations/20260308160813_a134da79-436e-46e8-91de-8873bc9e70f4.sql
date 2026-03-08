ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS has_logged_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_changed_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_completed_profile boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_login_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS password_changed_at timestamp with time zone;
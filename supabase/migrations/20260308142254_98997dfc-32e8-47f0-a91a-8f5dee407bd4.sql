
ALTER TABLE public.team_members 
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS temp_password text;

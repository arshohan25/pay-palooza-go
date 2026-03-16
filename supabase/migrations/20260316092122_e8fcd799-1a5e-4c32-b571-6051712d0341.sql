ALTER TABLE public.festival_themes ADD COLUMN IF NOT EXISTS theme_palette jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.festival_themes ADD COLUMN IF NOT EXISTS body_pattern text DEFAULT 'none';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lang_pref text NOT NULL DEFAULT 'en'
    CHECK (lang_pref IN ('en','bn'));

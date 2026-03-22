ALTER TABLE public.global_feature_toggles
ADD COLUMN visibility text NOT NULL DEFAULT 'visible';
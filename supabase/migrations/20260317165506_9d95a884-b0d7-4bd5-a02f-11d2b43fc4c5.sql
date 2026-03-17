ALTER TABLE public.promo_banners ALTER COLUMN title DROP NOT NULL;
ALTER TABLE public.promo_banners ALTER COLUMN title SET DEFAULT '';
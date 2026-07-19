
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS qr_card_tagline text,
  ADD COLUMN IF NOT EXISTS qr_card_band_color_start text,
  ADD COLUMN IF NOT EXISTS qr_card_band_color_end text,
  ADD COLUMN IF NOT EXISTS qr_card_logo_url text;

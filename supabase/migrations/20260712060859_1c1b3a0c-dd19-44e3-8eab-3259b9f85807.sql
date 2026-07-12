-- Canonical Bangladesh district → 2-letter wallet route code table.
-- Used by wallet-ID generation/validation for agent & merchant IDs
-- (EZP-AGN{RR}-XXXX / EZP-MRC{RR}-XXXX).

CREATE TABLE public.wallet_route_codes (
  code        text        PRIMARY KEY,
  district    text        NOT NULL UNIQUE,
  division    text        NOT NULL,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallet_route_codes_code_format
    CHECK (code ~ '^[A-Z]{2}$')
);

CREATE INDEX wallet_route_codes_division_idx ON public.wallet_route_codes (division);
CREATE INDEX wallet_route_codes_is_active_idx ON public.wallet_route_codes (is_active);

GRANT SELECT ON public.wallet_route_codes TO anon, authenticated;
GRANT ALL    ON public.wallet_route_codes TO service_role;

ALTER TABLE public.wallet_route_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Route codes are readable by everyone"
  ON public.wallet_route_codes
  FOR SELECT
  USING (true);

CREATE POLICY "Only service role manages route codes"
  ON public.wallet_route_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- updated_at trigger
CREATE TRIGGER wallet_route_codes_set_updated_at
  BEFORE UPDATE ON public.wallet_route_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Seed all 64 districts ────────────────────────────────────────────────
INSERT INTO public.wallet_route_codes (code, district, division) VALUES
  -- Barisal (6)
  ('BG','Barguna','Barisal'),
  ('BR','Barisal','Barisal'),
  ('BH','Bhola','Barisal'),
  ('JL','Jhalokati','Barisal'),
  ('PK','Patuakhali','Barisal'),
  ('PJ','Pirojpur','Barisal'),
  -- Chittagong (11)
  ('BN','Bandarban','Chittagong'),
  ('BB','Brahmanbaria','Chittagong'),
  ('CP','Chandpur','Chittagong'),
  ('CT','Chittagong','Chittagong'),
  ('CM','Comilla','Chittagong'),
  ('CX','Cox''s Bazar','Chittagong'),
  ('FN','Feni','Chittagong'),
  ('KG','Khagrachhari','Chittagong'),
  ('LK','Lakshmipur','Chittagong'),
  ('NK','Noakhali','Chittagong'),
  ('RM','Rangamati','Chittagong'),
  -- Dhaka (13)
  ('DH','Dhaka','Dhaka'),
  ('FP','Faridpur','Dhaka'),
  ('GZ','Gazipur','Dhaka'),
  ('GP','Gopalganj','Dhaka'),
  ('KS','Kishoreganj','Dhaka'),
  ('MP','Madaripur','Dhaka'),
  ('MG','Manikganj','Dhaka'),
  ('MJ','Munshiganj','Dhaka'),
  ('NR','Narayanganj','Dhaka'),
  ('NS','Narsingdi','Dhaka'),
  ('RB','Rajbari','Dhaka'),
  ('SP','Shariatpur','Dhaka'),
  ('TG','Tangail','Dhaka'),
  -- Khulna (10)
  ('BT','Bagerhat','Khulna'),
  ('CD','Chuadanga','Khulna'),
  ('JS','Jessore','Khulna'),
  ('JH','Jhenaidah','Khulna'),
  ('KH','Khulna','Khulna'),
  ('KT','Kushtia','Khulna'),
  ('MA','Magura','Khulna'),
  ('MH','Meherpur','Khulna'),
  ('NL','Narail','Khulna'),
  ('SK','Satkhira','Khulna'),
  -- Mymensingh (4)
  ('JP','Jamalpur','Mymensingh'),
  ('MM','Mymensingh','Mymensingh'),
  ('NT','Netrokona','Mymensingh'),
  ('SR','Sherpur','Mymensingh'),
  -- Rajshahi (8)
  ('BO','Bogra','Rajshahi'),
  ('CN','Chapainawabganj','Rajshahi'),
  ('JT','Joypurhat','Rajshahi'),
  ('NG','Naogaon','Rajshahi'),
  ('NO','Natore','Rajshahi'),
  ('PB','Pabna','Rajshahi'),
  ('RS','Rajshahi','Rajshahi'),
  ('SG','Sirajganj','Rajshahi'),
  -- Rangpur (8)
  ('DJ','Dinajpur','Rangpur'),
  ('GB','Gaibandha','Rangpur'),
  ('KM','Kurigram','Rangpur'),
  ('LM','Lalmonirhat','Rangpur'),
  ('NP','Nilphamari','Rangpur'),
  ('PG','Panchagarh','Rangpur'),
  ('RP','Rangpur','Rangpur'),
  ('TK','Thakurgaon','Rangpur'),
  -- Sylhet (4)
  ('HB','Habiganj','Sylhet'),
  ('MV','Moulvibazar','Sylhet'),
  ('SN','Sunamganj','Sylhet'),
  ('SY','Sylhet','Sylhet');

-- Sanity: exactly 64 rows seeded.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.wallet_route_codes;
  ASSERT n = 64, format('expected 64 route codes, got %s', n);
END;
$$;

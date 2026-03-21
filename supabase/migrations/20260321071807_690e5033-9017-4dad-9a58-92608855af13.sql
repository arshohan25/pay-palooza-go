
-- Add new columns to merchants table
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS bank_account_holder text,
  ADD COLUMN IF NOT EXISTS bank_branch text;

-- Create platform_banks table for admin-managed bank list
CREATE TABLE public.platform_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  short_code text NOT NULL,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.platform_banks ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active banks
CREATE POLICY "Anyone can read active banks" ON public.platform_banks
  FOR SELECT TO authenticated USING (is_active = true);

-- Admins can fully manage banks
CREATE POLICY "Admins can insert banks" ON public.platform_banks
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update banks" ON public.platform_banks
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete banks" ON public.platform_banks
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed all major Bangladeshi banks
INSERT INTO public.platform_banks (name, short_code, sort_order) VALUES
  ('Sonali Bank', 'SBL', 1),
  ('Janata Bank', 'JBL', 2),
  ('Agrani Bank', 'ABL', 3),
  ('Rupali Bank', 'RBL', 4),
  ('Bangladesh Development Bank', 'BDBL', 5),
  ('BASIC Bank', 'BASIC', 6),
  ('Bangladesh Krishi Bank', 'BKB', 7),
  ('Rajshahi Krishi Unnayan Bank', 'RKUB', 8),
  ('Probashi Kallyan Bank', 'PKB', 9),
  ('Karma Shangsthan Bank', 'KSB', 10),
  ('Dutch-Bangla Bank', 'DBBL', 11),
  ('BRAC Bank', 'BRAC', 12),
  ('Eastern Bank', 'EBL', 13),
  ('City Bank', 'CBL', 14),
  ('Prime Bank', 'PBL', 15),
  ('Islami Bank Bangladesh', 'IBBL', 16),
  ('Pubali Bank', 'PUBL', 17),
  ('Uttara Bank', 'UBL', 18),
  ('National Bank', 'NBL', 19),
  ('AB Bank', 'ABBL', 20),
  ('Bank Asia', 'BAL', 21),
  ('Mutual Trust Bank', 'MTB', 22),
  ('Southeast Bank', 'SEBL', 23),
  ('Dhaka Bank', 'DBL', 24),
  ('Jamuna Bank', 'JMB', 25),
  ('Mercantile Bank', 'MBL', 26),
  ('Standard Bank', 'SDBL', 27),
  ('One Bank', 'OBL', 28),
  ('NCC Bank', 'NCCBL', 29),
  ('Premier Bank', 'PRBL', 30),
  ('Trust Bank', 'TBL', 31),
  ('Midland Bank', 'MDBL', 32),
  ('NRB Bank', 'NRBB', 33),
  ('Meghna Bank', 'MGB', 34),
  ('Union Bank', 'UNBL', 35),
  ('Modhumoti Bank', 'MDMB', 36),
  ('Shimanto Bank', 'SMBL', 37),
  ('Padma Bank', 'PDBL', 38),
  ('Bengal Commercial Bank', 'BCBL', 39),
  ('Citizens Bank', 'CZBL', 40),
  ('Community Bank Bangladesh', 'CMBL', 41),
  ('Social Islami Bank', 'SIBL', 42),
  ('First Security Islami Bank', 'FSIBL', 43),
  ('Al-Arafah Islami Bank', 'AIBL', 44),
  ('EXIM Bank', 'EXIM', 45),
  ('Shahjalal Islami Bank', 'SJIBL', 46),
  ('ICB Islamic Bank', 'ICBI', 47),
  ('Union Digital Bank', 'UDB', 48),
  ('Standard Chartered Bangladesh', 'SCB', 49),
  ('HSBC Bangladesh', 'HSBC', 50),
  ('Citibank Bangladesh', 'CITI', 51),
  ('Commercial Bank of Ceylon', 'CBC', 52),
  ('State Bank of India Bangladesh', 'SBI', 53),
  ('Habib Bank', 'HBL', 54),
  ('National Bank of Pakistan', 'NBP', 55),
  ('Woori Bank Bangladesh', 'WBB', 56),
  ('Bank Al-Falah', 'BAF', 57),
  ('bKash', 'BKASH', 58),
  ('Nagad', 'NAGAD', 59),
  ('Rocket (DBBL Mobile)', 'ROCKET', 60);

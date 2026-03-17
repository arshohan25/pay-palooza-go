
-- Courier providers
CREATE TABLE public.courier_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  tracking_url_template text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.courier_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active couriers" ON public.courier_providers FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage couriers" ON public.courier_providers FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Delivery zones
CREATE TABLE public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name text NOT NULL,
  cities text[] NOT NULL DEFAULT '{}',
  delivery_fee numeric NOT NULL DEFAULT 0,
  estimated_days text DEFAULT '3-5 days',
  courier_provider_id uuid REFERENCES public.courier_providers(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active zones" ON public.delivery_zones FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage zones" ON public.delivery_zones FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Job listings
CREATE TABLE public.job_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department text,
  location text DEFAULT 'Bangladesh',
  type text DEFAULT 'full-time',
  description text,
  requirements text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active jobs" ON public.job_listings FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage jobs" ON public.job_listings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Job applications
CREATE TABLE public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.job_listings(id) ON DELETE CASCADE NOT NULL,
  user_id uuid,
  applicant_name text NOT NULL,
  applicant_phone text NOT NULL,
  applicant_email text,
  resume_url text,
  cover_note text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can apply" ON public.job_applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own applications" ON public.job_applications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage applications" ON public.job_applications FOR ALL USING (public.has_role(auth.uid(), 'admin'));

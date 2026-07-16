CREATE TABLE IF NOT EXISTS public._union_bn_staging (
  district text NOT NULL,
  upazila text NOT NULL,
  name text NOT NULL,
  name_bn text NOT NULL
);
GRANT ALL ON public._union_bn_staging TO service_role;
ALTER TABLE public._union_bn_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "svc only" ON public._union_bn_staging FOR ALL USING (false) WITH CHECK (false);
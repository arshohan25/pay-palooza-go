
-- Table for admin-customizable canned reply templates
CREATE TABLE public.admin_canned_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_canned_replies ENABLE ROW LEVEL SECURITY;

-- Admins can manage their own replies
CREATE POLICY "Admins can view own canned replies"
  ON public.admin_canned_replies FOR SELECT
  USING (auth.uid() = user_id AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert own canned replies"
  ON public.admin_canned_replies FOR INSERT
  WITH CHECK (auth.uid() = user_id AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update own canned replies"
  ON public.admin_canned_replies FOR UPDATE
  USING (auth.uid() = user_id AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete own canned replies"
  ON public.admin_canned_replies FOR DELETE
  USING (auth.uid() = user_id AND has_role(auth.uid(), 'admin'::app_role));

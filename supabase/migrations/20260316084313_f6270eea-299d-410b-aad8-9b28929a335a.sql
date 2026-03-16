
CREATE TABLE public.festival_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  preset_key text NOT NULL DEFAULT 'custom',
  greeting_text text NOT NULL DEFAULT '',
  accent_color text,
  emoji text NOT NULL DEFAULT '🎉',
  overlay_effect text NOT NULL DEFAULT 'none',
  banner_gradient text,
  is_active boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.festival_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage festival themes"
  ON public.festival_themes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can read active themes"
  ON public.festival_themes FOR SELECT TO authenticated
  USING (is_active = true);

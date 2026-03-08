
-- Team members table
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  department text DEFAULT 'general',
  is_available boolean DEFAULT true,
  last_active_at timestamptz,
  created_by uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage team members" ON public.team_members FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Team members can view own record" ON public.team_members FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Team access permissions table
CREATE TABLE public.team_access_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  section text NOT NULL,
  can_view boolean DEFAULT true,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  granted_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, section)
);
ALTER TABLE public.team_access_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage team permissions" ON public.team_access_permissions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own permissions" ON public.team_access_permissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for team tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;

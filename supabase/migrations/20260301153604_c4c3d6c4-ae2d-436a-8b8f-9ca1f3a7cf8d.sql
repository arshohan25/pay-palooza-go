
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  permission TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'prompt',
  device_info JSONB DEFAULT '{}',
  granted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, permission)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Users can view own permissions
CREATE POLICY "Users can view own permissions"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert own permissions
CREATE POLICY "Users can insert own permissions"
ON public.user_permissions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update own permissions
CREATE POLICY "Users can update own permissions"
ON public.user_permissions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all permissions
CREATE POLICY "Admins can view all permissions"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.deleted_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text,
  phone text,
  avatar_url text,
  balance_at_deletion numeric DEFAULT 0,
  profile_data jsonb DEFAULT '{}'::jsonb,
  transactions jsonb DEFAULT '[]'::jsonb,
  roles jsonb DEFAULT '[]'::jsonb,
  kyc_data jsonb DEFAULT '{}'::jsonb,
  notifications jsonb DEFAULT '[]'::jsonb,
  support_conversations jsonb DEFAULT '[]'::jsonb,
  referrals jsonb DEFAULT '[]'::jsonb,
  other_data jsonb DEFAULT '{}'::jsonb,
  deleted_by uuid,
  deleted_at timestamptz DEFAULT now(),
  deletion_reason text,
  balance_recovered numeric DEFAULT 0
);

ALTER TABLE public.deleted_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read deleted_users"
  ON public.deleted_users
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

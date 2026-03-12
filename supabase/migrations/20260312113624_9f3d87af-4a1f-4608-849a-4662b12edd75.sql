
-- Create support_complaints table (no FK to support_conversations yet)
CREATE TABLE IF NOT EXISTS public.support_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_number TEXT UNIQUE NOT NULL,
  conversation_id UUID NOT NULL,
  raised_by UUID NOT NULL,
  assigned_to UUID,
  subject TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access on support_complaints"
ON public.support_complaints
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));


CREATE TABLE IF NOT EXISTS public.dispute_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL DEFAULT 'agent',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.dispute_messages TO authenticated;
GRANT ALL ON public.dispute_messages TO service_role;

ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Complainant or assignee can read messages"
ON public.dispute_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.disputes d
    WHERE d.id = dispute_id
      AND (d.complainant_id = auth.uid() OR d.assigned_to = auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Complainant or assignee can post messages"
ON public.dispute_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.disputes d
      WHERE d.id = dispute_id
        AND (d.complainant_id = auth.uid() OR d.assigned_to = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute ON public.dispute_messages(dispute_id, created_at);

ALTER PUBLICATION supabase_realtime ADD TABLE public.dispute_messages;

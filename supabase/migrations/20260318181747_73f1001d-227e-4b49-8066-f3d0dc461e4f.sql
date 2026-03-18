-- Phase 1: Public SELECT on merchants for anonymous product viewing
CREATE POLICY "Public can read merchants for shop"
ON public.merchants FOR SELECT TO public USING (true);

-- Phase 5: Admin can view all chat conversations
CREATE POLICY "Admins can view all chat conversations"
ON public.chat_conversations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Phase 5: Admin can view all chat messages
CREATE POLICY "Admins can view all chat messages"
ON public.chat_messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create chat_attachments storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('chat_attachments', 'chat_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for chat_attachments: authenticated users can upload
CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat_attachments');

-- RLS for chat_attachments: public can read
CREATE POLICY "Public can read chat attachments"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'chat_attachments');
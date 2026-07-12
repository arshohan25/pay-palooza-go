
CREATE POLICY "Users upload own dispute evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'dispute-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own dispute evidence"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'dispute-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own dispute evidence"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'dispute-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

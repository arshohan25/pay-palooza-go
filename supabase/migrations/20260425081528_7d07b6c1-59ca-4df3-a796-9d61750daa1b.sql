DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'platform_thresholds' AND cmd = 'DELETE'
  ) THEN
    CREATE POLICY "Admins delete thresholds"
      ON public.platform_thresholds FOR DELETE
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Replace the overly permissive INSERT policy with one that allows authenticated users to insert only their own notifications
DROP POLICY "Service can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

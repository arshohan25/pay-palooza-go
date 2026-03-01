
-- Add admin SELECT policy on device_registrations
CREATE POLICY "Admins can view all device registrations"
ON public.device_registrations
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));


-- Approval requests
DROP POLICY IF EXISTS "Authorized staff can manage approval requests" ON public.admin_approval_requests;
CREATE POLICY "Authorized staff can manage approval requests"
ON public.admin_approval_requests FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'compliance')
  OR public.has_role(auth.uid(),'finance') OR public.has_role(auth.uid(),'operations')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'compliance')
  OR public.has_role(auth.uid(),'finance') OR public.has_role(auth.uid(),'operations')
);

-- Brand settings
DROP POLICY IF EXISTS "Authorized staff can manage brand settings" ON public.admin_brand_settings;
CREATE POLICY "Authorized staff can manage brand settings"
ON public.admin_brand_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'marketing'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'marketing'));

-- Bulk actions
DROP POLICY IF EXISTS "Authorized staff can manage bulk actions" ON public.admin_bulk_actions;
CREATE POLICY "Authorized staff can manage bulk actions"
ON public.admin_bulk_actions FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations'));

-- Evidence vault
DROP POLICY IF EXISTS "Authorized staff can manage evidence vault" ON public.admin_evidence_vault;
CREATE POLICY "Authorized staff can manage evidence vault"
ON public.admin_evidence_vault FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'compliance')
  OR public.has_role(auth.uid(),'risk') OR public.has_role(auth.uid(),'audit')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'compliance')
  OR public.has_role(auth.uid(),'risk') OR public.has_role(auth.uid(),'audit')
);

-- Launch calendar
DROP POLICY IF EXISTS "Authorized staff can manage launch calendar" ON public.admin_launch_calendar;
CREATE POLICY "Authorized staff can manage launch calendar"
ON public.admin_launch_calendar FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'marketing')
  OR public.has_role(auth.uid(),'operations')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'marketing')
  OR public.has_role(auth.uid(),'operations')
);

-- Security policies
DROP POLICY IF EXISTS "Authorized staff can manage security policies" ON public.admin_security_policies;
CREATE POLICY "Authorized staff can manage security policies"
ON public.admin_security_policies FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'compliance')
  OR public.has_role(auth.uid(),'risk')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'compliance')
  OR public.has_role(auth.uid(),'risk')
);

-- User notes
DROP POLICY IF EXISTS "Authorized staff can manage admin user notes" ON public.admin_user_notes;
CREATE POLICY "Authorized staff can manage admin user notes"
ON public.admin_user_notes FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support')
  OR public.has_role(auth.uid(),'operations') OR public.has_role(auth.uid(),'compliance')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'support')
  OR public.has_role(auth.uid(),'operations') OR public.has_role(auth.uid(),'compliance')
);

-- User segments
DROP POLICY IF EXISTS "Authorized staff can manage user segments" ON public.admin_user_segments;
CREATE POLICY "Authorized staff can manage user segments"
ON public.admin_user_segments FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'marketing'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'marketing'));

-- Notification templates
DROP POLICY IF EXISTS "Authorized staff can manage notification templates" ON public.notification_templates;
CREATE POLICY "Authorized staff can manage notification templates"
ON public.notification_templates FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'marketing')
  OR public.has_role(auth.uid(),'operations')
)
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'marketing')
  OR public.has_role(auth.uid(),'operations')
);

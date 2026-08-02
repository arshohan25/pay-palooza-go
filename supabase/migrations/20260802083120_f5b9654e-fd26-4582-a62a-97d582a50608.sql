-- Allow team members to update their own onboarding/presence state,
-- while blocking self-service edits to identity/privilege columns.

CREATE OR REPLACE FUNCTION public.guard_team_member_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins and service_role bypass the column lock entirely.
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Self-update path: identity and privilege columns are immutable.
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.username IS DISTINCT FROM OLD.username
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.display_name IS DISTINCT FROM OLD.display_name
     OR NEW.department IS DISTINCT FROM OLD.department
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION 'Only an admin can change team member identity or department fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_team_member_self_update ON public.team_members;
CREATE TRIGGER trg_guard_team_member_self_update
BEFORE UPDATE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.guard_team_member_self_update();

DROP POLICY IF EXISTS "Team members can update own onboarding state" ON public.team_members;
CREATE POLICY "Team members can update own onboarding state"
ON public.team_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

GRANT SELECT, UPDATE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
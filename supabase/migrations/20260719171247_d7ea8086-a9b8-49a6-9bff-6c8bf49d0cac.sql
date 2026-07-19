
CREATE OR REPLACE FUNCTION public.assign_single_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing app_role;
  v_phone text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can assign roles' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_existing FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  SELECT phone INTO v_phone FROM public.profiles WHERE user_id = _user_id LIMIT 1;

  IF v_existing IS NOT NULL THEN
    IF v_existing = _role THEN
      RAISE EXCEPTION 'Phone % is already assigned the ''%'' role. No changes made.',
        COALESCE(v_phone,'(unknown)'), _role
        USING ERRCODE = '23505';
    ELSE
      RAISE EXCEPTION 'Phone % already holds the ''%'' role. Each phone number can hold only one role. Revoke the existing role before assigning ''%''.',
        COALESCE(v_phone,'(unknown)'), v_existing, _role
        USING ERRCODE = '23505';
    END IF;
  END IF;

  INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, _role);
END;
$$;

REVOKE ALL ON FUNCTION public.assign_single_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_single_role(uuid, app_role) TO authenticated;

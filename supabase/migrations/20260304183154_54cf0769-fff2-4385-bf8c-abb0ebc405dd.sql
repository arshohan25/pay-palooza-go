CREATE OR REPLACE FUNCTION public.get_blocked_user_profiles(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, name text, phone text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id, p.name, p.phone, p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = ANY(p_user_ids) AND p.status = 'active';
$$;
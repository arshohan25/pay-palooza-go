-- Secure phone lookup for chat requests (returns only minimal public-safe fields)
CREATE OR REPLACE FUNCTION public.find_chat_user_by_phone(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_norm text;
  v_user record;
BEGIN
  v_me := auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_norm := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  IF v_norm = '' THEN
    RETURN NULL;
  END IF;

  -- Normalize BD prefixes to local 11-digit form used in profiles
  IF left(v_norm, 2) = '88' AND length(v_norm) > 11 THEN
    v_norm := substring(v_norm FROM 3);
  END IF;

  SELECT p.user_id, p.name, p.phone, p.avatar_url
  INTO v_user
  FROM public.profiles p
  WHERE p.status = 'active'
    AND p.user_id <> v_me
    AND p.phone IN (v_norm, '88' || v_norm, '+88' || v_norm)
  ORDER BY CASE WHEN p.phone = v_norm THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_user.user_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_user.user_id,
    'name', v_user.name,
    'phone', v_user.phone,
    'avatar_url', v_user.avatar_url
  );
END;
$$;

-- Atomic direct chat request creation (works even with strict RLS)
CREATE OR REPLACE FUNCTION public.create_direct_chat_request(p_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_conv_id uuid;
  v_sender_name text;
  v_is_new boolean := false;
BEGIN
  v_me := auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_other_user_id IS NULL OR p_other_user_id = v_me THEN
    RAISE EXCEPTION 'Invalid target user';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = p_other_user_id
      AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Target account not found';
  END IF;

  -- Reuse an existing direct conversation if both users are participants
  SELECT c.id
  INTO v_conv_id
  FROM public.chat_conversations c
  WHERE c.type = 'direct'
    AND EXISTS (
      SELECT 1 FROM public.chat_participants p1
      WHERE p1.conversation_id = c.id AND p1.user_id = v_me
    )
    AND EXISTS (
      SELECT 1 FROM public.chat_participants p2
      WHERE p2.conversation_id = c.id AND p2.user_id = p_other_user_id
    )
  ORDER BY c.updated_at DESC
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    v_is_new := true;

    INSERT INTO public.chat_conversations (type, status, admin_id)
    VALUES ('direct', 'pending', v_me)
    RETURNING id INTO v_conv_id;

    INSERT INTO public.chat_participants (conversation_id, user_id, last_read_at)
    VALUES (v_conv_id, v_me, now())
    ON CONFLICT DO NOTHING;

    INSERT INTO public.chat_participants (conversation_id, user_id, last_read_at)
    VALUES (v_conv_id, p_other_user_id, now())
    ON CONFLICT DO NOTHING;
  END IF;

  -- Notify recipient only when this is a newly created request
  IF v_is_new THEN
    SELECT COALESCE(name, phone, 'Someone')
    INTO v_sender_name
    FROM public.profiles
    WHERE user_id = v_me
    LIMIT 1;

    INSERT INTO public.notifications (user_id, title, body, category, metadata)
    VALUES (
      p_other_user_id,
      'New Message Request',
      COALESCE(v_sender_name, 'Someone') || ' wants to chat with you',
      'chat',
      jsonb_build_object('conversation_id', v_conv_id, 'sender_id', v_me)
    );
  END IF;

  RETURN v_conv_id;
END;
$$;

-- Lock down execution scope to authenticated users only
REVOKE ALL ON FUNCTION public.find_chat_user_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_chat_user_by_phone(text) TO authenticated;

REVOKE ALL ON FUNCTION public.create_direct_chat_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_direct_chat_request(uuid) TO authenticated;
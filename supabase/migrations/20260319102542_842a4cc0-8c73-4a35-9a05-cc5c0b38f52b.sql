
-- Step 1: Add metadata column to chat_conversations
ALTER TABLE public.chat_conversations 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Step 2: Update create_direct_chat_request RPC to accept optional metadata
CREATE OR REPLACE FUNCTION public.create_direct_chat_request(
  p_other_user_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- For merchant inquiries, look for existing merchant conversation specifically
  IF p_metadata->>'context' = 'merchant_inquiry' THEN
    SELECT c.id
    INTO v_conv_id
    FROM public.chat_conversations c
    WHERE c.type = 'direct'
      AND c.metadata->>'context' = 'merchant_inquiry'
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
  ELSE
    -- For personal chats, find existing non-merchant conversation
    SELECT c.id
    INTO v_conv_id
    FROM public.chat_conversations c
    WHERE c.type = 'direct'
      AND (c.metadata IS NULL OR c.metadata = '{}'::jsonb OR c.metadata->>'context' IS NULL OR c.metadata->>'context' != 'merchant_inquiry')
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
  END IF;

  IF v_conv_id IS NULL THEN
    v_is_new := true;

    INSERT INTO public.chat_conversations (type, status, admin_id, metadata)
    VALUES ('direct', 'pending', v_me, COALESCE(p_metadata, '{}'::jsonb))
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
$function$;

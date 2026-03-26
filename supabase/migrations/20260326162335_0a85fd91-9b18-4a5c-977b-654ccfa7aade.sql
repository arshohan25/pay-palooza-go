-- Drop the single-argument overload that causes PGRST203 ambiguity
DROP FUNCTION IF EXISTS public.create_direct_chat_request(uuid);

-- The two-argument version (uuid, jsonb DEFAULT '{}') remains as-is
-- No need to recreate it since it already exists with the correct signature
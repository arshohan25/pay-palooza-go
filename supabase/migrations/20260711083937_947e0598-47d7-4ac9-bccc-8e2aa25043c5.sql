-- 1. Source column on payment_links (safe if re-run)
ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app';

-- 2. MCP tool call logs
CREATE TABLE IF NOT EXISTS public.mcp_tool_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id text,
  tool_name text NOT NULL,
  arguments jsonb,
  status text NOT NULL CHECK (status IN ('succeeded','failed')),
  result_summary text,
  error text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mcp_tool_call_logs TO authenticated;
GRANT ALL   ON public.mcp_tool_call_logs TO service_role;

ALTER TABLE public.mcp_tool_call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own MCP logs" ON public.mcp_tool_call_logs;
CREATE POLICY "Users can view their own MCP logs"
ON public.mcp_tool_call_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all MCP logs" ON public.mcp_tool_call_logs;
CREATE POLICY "Admins can view all MCP logs"
ON public.mcp_tool_call_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS mcp_tool_call_logs_user_id_created_at_idx
  ON public.mcp_tool_call_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mcp_tool_call_logs_created_at_idx
  ON public.mcp_tool_call_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS mcp_tool_call_logs_correlation_id_idx
  ON public.mcp_tool_call_logs (correlation_id);

-- 3. Enable realtime for the admin activity view
ALTER TABLE public.mcp_tool_call_logs REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mcp_tool_call_logs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mcp_tool_call_logs';
  END IF;
END $$;

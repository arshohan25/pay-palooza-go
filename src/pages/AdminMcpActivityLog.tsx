import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/Seo";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type LogRow = {
  id: string;
  correlation_id: string;
  user_id: string | null;
  client_id: string | null;
  tool_name: string;
  arguments: Record<string, unknown> | null;
  status: "succeeded" | "failed";
  result_summary: string | null;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
};

export default function AdminMcpActivityLog() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "succeeded" | "failed">("all");

  useEffect(() => {
    let active = true;
    const load = async () => {
      let q = supabase
        .from("mcp_tool_call_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter !== "all") q = q.eq("status", filter);
      const { data } = await q;
      if (!active) return;
      setRows((data ?? []) as LogRow[]);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel("mcp-tool-call-logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mcp_tool_call_logs" },
        (payload) => {
          setRows((prev) => [payload.new as LogRow, ...prev].slice(0, 200));
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [filter]);

  return (
    <div className="min-h-screen bg-background p-6">
      <Seo title="MCP Activity — Admin" description="AI assistant tool call activity log" path="/admin/mcp-activity" />
      <div className="max-w-5xl mx-auto space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">MCP Activity Log</h1>
          <p className="text-sm text-muted-foreground">
            Every call to the EasyPay MCP tools (create_payment_request, get_payment_status, list_payment_requests) is
            recorded here in real time with a correlation ID for support and audit.
          </p>
        </header>

        <div className="flex items-center gap-2">
          {(["all", "succeeded", "failed"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-full text-xs border ${
                filter === k ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
              }`}
            >
              {k}
            </button>
          ))}
          <span className="text-xs text-muted-foreground ml-auto">{rows.length} events</span>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No MCP tool calls yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {rows.map((r) => (
                  <div key={r.id} className="p-4 text-sm space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={r.status === "succeeded" ? "default" : "destructive"}>{r.status}</Badge>
                      <code className="font-medium">{r.tool_name}</code>
                      <span className="text-muted-foreground text-xs">
                        {format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss")}
                      </span>
                      {r.duration_ms != null && (
                        <span className="text-muted-foreground text-xs">· {r.duration_ms}ms</span>
                      )}
                      <span className="text-muted-foreground text-xs ml-auto font-mono">
                        {r.correlation_id.slice(0, 8)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      user: <code>{r.user_id ?? "—"}</code>
                      {r.client_id ? <> · client: <code>{r.client_id}</code></> : null}
                    </div>
                    {r.arguments && Object.keys(r.arguments).length > 0 && (
                      <pre className="text-[11px] bg-muted/40 rounded p-2 overflow-x-auto">
                        {JSON.stringify(r.arguments, null, 2)}
                      </pre>
                    )}
                    {r.result_summary && (
                      <p className="text-xs text-foreground/80">{r.result_summary}</p>
                    )}
                    {r.error && (
                      <p className="text-xs text-destructive">error: {r.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

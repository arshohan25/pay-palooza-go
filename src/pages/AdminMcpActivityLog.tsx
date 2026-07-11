import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/Seo";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Download, ExternalLink } from "lucide-react";

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

// Extract a short_code from tool args or result_summary so we can link to the
// related payment request detail view.
function extractShortCode(r: LogRow): string | null {
  const argCode = (r.arguments as { short_code?: unknown } | null)?.short_code;
  if (typeof argCode === "string" && argCode.trim()) return argCode.trim();
  const summary = r.result_summary ?? "";
  const m = summary.match(/\/r\/([A-Z0-9]{4,})/i);
  if (m) return m[1];
  return null;
}

function download(filename: string, mime: string, body: string) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCsv(rows: LogRow[]): string {
  const cols = [
    "created_at", "correlation_id", "tool_name", "status", "duration_ms",
    "user_id", "client_id", "result_summary", "error", "arguments",
  ] as const;
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => escape((r as any)[c])).join(",")),
  ].join("\n");
}

export default function AdminMcpActivityLog() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "succeeded" | "failed">("all");
  const [correlationFilter, setCorrelationFilter] = useState("");

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

  const filteredRows = useMemo(() => {
    const cid = correlationFilter.trim().toLowerCase();
    if (!cid) return rows;
    return rows.filter((r) => r.correlation_id.toLowerCase().includes(cid));
  }, [rows, correlationFilter]);

  const exportCsv = () => {
    download(
      `mcp-activity-${new Date().toISOString().slice(0, 10)}.csv`,
      "text/csv;charset=utf-8",
      toCsv(filteredRows),
    );
  };
  const exportJson = () => {
    download(
      `mcp-activity-${new Date().toISOString().slice(0, 10)}.json`,
      "application/json",
      JSON.stringify(filteredRows, null, 2),
    );
  };

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

        <div className="flex items-center gap-2 flex-wrap">
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
          <Input
            value={correlationFilter}
            onChange={(e) => setCorrelationFilter(e.target.value)}
            placeholder="Filter by correlation ID…"
            className="h-8 text-xs max-w-[220px]"
          />
          <span className="text-xs text-muted-foreground">{filteredRows.length} events</span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filteredRows.length}>
              <Download className="w-3.5 h-3.5 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportJson} disabled={!filteredRows.length}>
              <Download className="w-3.5 h-3.5 mr-1" /> JSON
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground">Loading…</p>
            ) : filteredRows.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No MCP tool calls match these filters.</p>
            ) : (
              <div className="divide-y divide-border">
                {filteredRows.map((r) => {
                  const code = extractShortCode(r);
                  return (
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
                        {code && (
                          <Link
                            to={`/r/${code}`}
                            className="text-xs inline-flex items-center gap-1 text-primary hover:underline"
                            title={`Open payment request ${code}`}
                          >
                            <ExternalLink className="w-3 h-3" /> {code}
                          </Link>
                        )}
                        <Link
                          to={`/admin/mcp-activity?cid=${r.correlation_id}`}
                          onClick={(e) => { e.preventDefault(); setCorrelationFilter(r.correlation_id); }}
                          className="text-muted-foreground text-xs ml-auto font-mono hover:underline"
                          title="Filter by this correlation ID"
                        >
                          {r.correlation_id.slice(0, 8)}
                        </Link>
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
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

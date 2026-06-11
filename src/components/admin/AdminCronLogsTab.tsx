import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type LogRow = {
  id: string;
  function_name: string;
  triggered_by: string;
  auth_method: string;
  status_code: number;
  processed: number; skipped: number; settled: number; missed: number; dedup: number;
  schedule_count: number;
  duration_ms: number | null;
  request_id: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
};

const PAGE_SIZE = 50;

function statusColor(code: number): string {
  if (code === 200) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (code === 401 || code === 403) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  if (code >= 500) return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
}

export default function AdminCronLogsTab() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [triggerFilter, setTriggerFilter] = useState<string>("all");
  const [rangeDays, setRangeDays] = useState<string>("7");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - Number(rangeDays) * 86400_000).toISOString();
    let q = (supabase.from as any)("cron_invocation_log")
      .select("*", { count: "exact" })
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (statusFilter === "200") q = q.eq("status_code", 200);
    else if (statusFilter === "401") q = q.eq("status_code", 401);
    else if (statusFilter === "5xx") q = q.gte("status_code", 500);
    else if (statusFilter === "4xx") q = q.gte("status_code", 400).lt("status_code", 500);

    if (triggerFilter !== "all") q = q.eq("triggered_by", triggerFilter);

    const { data, error, count } = await q;
    if (error) toast.error(error.message);
    else { setLogs((data as LogRow[]) ?? []); setTotalCount(count ?? 0); }
    setLoading(false);
  }, [statusFilter, triggerFilter, rangeDays, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("admin-cron-logs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cron_invocation_log" } as any, () => {
        if (page === 0) fetchLogs();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchLogs, page]);

  const exportCsv = () => {
    const cols = ["created_at","function_name","triggered_by","auth_method","status_code","processed","skipped","settled","missed","dedup","schedule_count","duration_ms","request_id","error_code","error_message"];
    const lines = [cols.join(",")];
    for (const l of logs) {
      lines.push(cols.map((c) => {
        const v = (l as any)[c];
        if (v == null) return "";
        const s = String(v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      }).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cron-logs-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={(v) => { setPage(0); setStatusFilter(v); }}>
          <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="200">200 OK</SelectItem>
            <SelectItem value="401">401</SelectItem>
            <SelectItem value="4xx">4xx</SelectItem>
            <SelectItem value="5xx">5xx</SelectItem>
          </SelectContent>
        </Select>
        <Select value={triggerFilter} onValueChange={(v) => { setPage(0); setTriggerFilter(v); }}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All triggers</SelectItem>
            <SelectItem value="cron">Cron</SelectItem>
            <SelectItem value="retry">Retry</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
        <Select value={rangeDays} onValueChange={(v) => { setPage(0); setRangeDays(v); }}>
          <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24h</SelectItem>
            <SelectItem value="7">Last 7d</SelectItem>
            <SelectItem value="30">Last 30d</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchLogs}><RefreshCw size={14} className="mr-1" />Refresh</Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={logs.length === 0}>
            <Download size={14} className="mr-1" />CSV
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {loading ? "Loading…" : `${totalCount} log row${totalCount === 1 ? "" : "s"}`}
      </p>

      <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Auth</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Counters</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px] capitalize">{l.triggered_by}</Badge></TableCell>
                <TableCell><Badge variant="secondary" className="text-[10px]">{l.auth_method}</Badge></TableCell>
                <TableCell><Badge className={`text-[10px] ${statusColor(l.status_code)}`}>{l.status_code}</Badge></TableCell>
                <TableCell className="text-[11px] text-muted-foreground">
                  ok {l.processed} · settled {l.settled} · missed {l.missed} · dedup {l.dedup} · skip {l.skipped}
                  <br />
                  <span className="text-[10px]">({l.schedule_count} considered)</span>
                </TableCell>
                <TableCell className="text-xs">{l.duration_ms != null ? `${l.duration_ms}ms` : "—"}</TableCell>
                <TableCell className="text-xs text-destructive">
                  {l.error_code ? <><strong>{l.error_code}</strong><br /><span className="text-[10px] text-muted-foreground">{l.error_message}</span></> : <span className="text-muted-foreground">—</span>}
                </TableCell>
              </TableRow>
            ))}
            {!loading && logs.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">No log entries match these filters.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">Page {page + 1} of {pageCount}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}

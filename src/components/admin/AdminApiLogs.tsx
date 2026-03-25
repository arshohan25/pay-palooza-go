import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Activity, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

interface Props { search: string; }

export default function AdminApiLogs({ search }: Props) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "2xx" | "4xx" | "5xx">("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any).from("merchant_api_logs").select("*").order("created_at", { ascending: false }).limit(200);
    const { data } = await query;
    setLogs(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    const ch = supabase.channel("admin-api-logs-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "merchant_api_logs" }, () => fetchLogs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchLogs]);

  const filtered = logs.filter(l => {
    if (statusFilter === "2xx" && (l.status_code < 200 || l.status_code >= 300)) return false;
    if (statusFilter === "4xx" && (l.status_code < 400 || l.status_code >= 500)) return false;
    if (statusFilter === "5xx" && l.status_code < 500) return false;
    if (search && !(l.action?.toLowerCase().includes(search.toLowerCase()) || l.ip_address?.includes(search) || l.merchant_id?.includes(search))) return false;
    return true;
  });

  const totalRequests = filtered.length;
  const successCount = filtered.filter(l => l.status_code >= 200 && l.status_code < 300).length;
  const successRate = totalRequests ? Math.round((successCount / totalRequests) * 100) : 0;
  const avgResponseTime = totalRequests ? Math.round(filtered.reduce((s, l) => s + (l.response_time_ms || 0), 0) / totalRequests) : 0;
  const errorCount = filtered.filter(l => l.status_code >= 400).length;

  const statusColor = (code: number) => {
    if (code >= 200 && code < 300) return "default";
    if (code >= 400 && code < 500) return "secondary";
    return "destructive";
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Activity className="w-7 h-7 text-primary" />
          <div><p className="text-xl font-bold text-foreground">{totalRequests}</p><p className="text-xs text-muted-foreground">Total Requests</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <CheckCircle className="w-7 h-7 text-emerald-500" />
          <div><p className="text-xl font-bold text-foreground">{successRate}%</p><p className="text-xs text-muted-foreground">Success Rate</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Clock className="w-7 h-7 text-amber-500" />
          <div><p className="text-xl font-bold text-foreground">{avgResponseTime}ms</p><p className="text-xs text-muted-foreground">Avg Response</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <XCircle className="w-7 h-7 text-destructive" />
          <div><p className="text-xl font-bold text-foreground">{errorCount}</p><p className="text-xs text-muted-foreground">Errors</p></div>
        </CardContent></Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="2xx">2xx Success</SelectItem>
            <SelectItem value="4xx">4xx Client</SelectItem>
            <SelectItem value="5xx">5xx Server</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Response</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No logs found</TableCell></TableRow>
            ) : filtered.slice(0, 100).map(log => (
              <React.Fragment key={log.id}>
                <TableRow className="cursor-pointer" onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}>
                  <TableCell>{expandedRow === log.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(log.created_at), "dd MMM HH:mm:ss")}</TableCell>
                  <TableCell className="text-xs font-medium">{log.action || "—"}</TableCell>
                  <TableCell><Badge variant={statusColor(log.status_code)} className="text-xs">{log.status_code}</Badge></TableCell>
                  <TableCell className="text-xs">{log.response_time_ms ? `${log.response_time_ms}ms` : "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{log.ip_address || "—"}</TableCell>
                  <TableCell className="text-xs text-destructive max-w-[150px] truncate">{log.error_message || "—"}</TableCell>
                </TableRow>
                {expandedRow === log.id && (
                  <TableRow>
                    <TableCell colSpan={7} className="bg-muted/30 text-xs space-y-1 py-3">
                      <p><span className="font-medium">Merchant ID:</span> {log.merchant_id}</p>
                      <p><span className="font-medium">User Agent:</span> {log.user_agent || "—"}</p>
                      {log.error_message && <p><span className="font-medium">Full Error:</span> {log.error_message}</p>}
                      {log.request_body && <p><span className="font-medium">Request:</span> <code className="text-xs break-all">{typeof log.request_body === "object" ? JSON.stringify(log.request_body) : log.request_body}</code></p>}
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

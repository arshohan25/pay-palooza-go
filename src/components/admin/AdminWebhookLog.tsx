import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeIndicator } from "@/hooks/use-realtime-indicator";
import RealtimeUpdateIndicator from "@/components/admin/RealtimeUpdateIndicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RefreshCw, ChevronDown, ChevronRight, Radio, Webhook } from "lucide-react";
import { format } from "date-fns";

interface PaymentSession {
  id: string;
  provider: string;
  amount: number;
  fee: number;
  status: string;
  provider_payment_id: string | null;
  provider_trx_id: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  completed_at: string | null;
  user_id: string;
}

interface AuditEntry {
  id: string;
  action: string;
  entity_id: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const PROVIDER_COLORS: Record<string, string> = {
  bkash: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  nagad: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  asthapay: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

export default function AdminWebhookLog() {
  const [sessions, setSessions] = useState<PaymentSession[]>([]);
  const { visible, flash } = useRealtimeIndicator();
  const [auditMap, setAuditMap] = useState<Record<string, AuditEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [providerFilter, setProviderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("payment_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (providerFilter !== "all") query = query.eq("provider", providerFilter);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);

    const { data: sessionsData } = await query;
    const rows = (sessionsData ?? []) as PaymentSession[];
    setSessions(rows);

    // Fetch related audit logs for credit events
    const { data: auditData } = await supabase
      .from("audit_logs")
      .select("*")
      .in("action", ["payment_credit_webhook", "payment_credit_ipn", "payment_credit_callback", "payment_credit"])
      .order("created_at", { ascending: false })
      .limit(200);

    const map: Record<string, AuditEntry[]> = {};
    (auditData ?? []).forEach((a: any) => {
      const sessionId = a.details?.session_id || a.entity_id;
      if (sessionId) {
        if (!map[sessionId]) map[sessionId] = [];
        map[sessionId].push(a);
      }
    });
    setAuditMap(map);
    setLoading(false);
  }, [providerFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription for live updates
  useEffect(() => {
    if (!isLive) return;

    const channel = supabase
      .channel("admin-webhook-log")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_sessions" },
        () => {
          load();
          flash();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLive, load]);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-bold">Webhook / IPN Event Log</CardTitle>
            {isLive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                <Radio className="w-3 h-3 animate-pulse" />
                Live
              </span>
            )}
            <RealtimeUpdateIndicator visible={visible} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                <SelectItem value="bkash">bKash</SelectItem>
                <SelectItem value="nagad">Nagad</SelectItem>
                <SelectItem value="asthapay">AsthaPay</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <div className="bg-muted/50 rounded-lg p-1 flex gap-0.5">
              <button className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${isLive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setIsLive(true)}>
                <Radio className={`w-3.5 h-3.5 ${isLive ? "animate-pulse" : ""}`} /> Live
              </button>
              <button className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${!isLive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setIsLive(false)}>
                Paused
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-8 gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-12 text-center">
            <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
              <Webhook className="w-7 h-7 text-muted-foreground" />
            </motion.div>
            <p className="text-sm font-semibold text-foreground">No payment sessions found</p>
            <p className="text-xs text-muted-foreground mt-1">Payment sessions will appear here</p>
          </motion.div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead className="text-xs">Time</TableHead>
                  <TableHead className="text-xs">Provider</TableHead>
                  <TableHead className="text-xs">Amount</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Provider TxnID</TableHead>
                  <TableHead className="text-xs">Session ID</TableHead>
                  <TableHead className="text-xs">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map(s => {
                  const isExpanded = expandedId === s.id;
                  const audits = auditMap[s.id] ?? [];
                  return (
                    <Collapsible key={s.id} open={isExpanded} onOpenChange={() => toggleExpand(s.id)} asChild>
                      <>
                        <CollapsibleTrigger asChild>
                          <TableRow className="cursor-pointer hover:bg-muted/50">
                            <TableCell className="p-2">
                              {isExpanded
                                ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {format(new Date(s.created_at), "MMM dd HH:mm:ss")}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${PROVIDER_COLORS[s.provider] ?? "bg-muted text-muted-foreground"}`}>
                                {s.provider}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs font-medium">৳{s.amount.toLocaleString()}</TableCell>
                            <TableCell>
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[s.status] ?? "bg-muted text-muted-foreground"}`}>
                                {s.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground max-w-[140px] truncate">
                              {s.provider_trx_id || s.provider_payment_id || "—"}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground max-w-[100px] truncate">
                              {s.id.slice(0, 8)}…
                            </TableCell>
                            <TableCell>
                              {audits.length > 0 ? (
                                <Badge variant="secondary" className="text-[10px]">✓ Credited</Badge>
                              ) : s.status === "completed" ? (
                                <Badge variant="outline" className="text-[10px]">Verified</Badge>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <tr>
                            <td colSpan={8} className="p-0">
                              <div className="bg-muted/30 border-t border-b border-border p-4 space-y-3">
                                {/* Session details */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Session ID</span>
                                    <p className="font-mono break-all">{s.id}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">User ID</span>
                                    <p className="font-mono break-all">{s.user_id.slice(0, 12)}…</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Fee</span>
                                    <p>৳{s.fee}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Completed At</span>
                                    <p>{s.completed_at ? format(new Date(s.completed_at), "MMM dd HH:mm:ss") : "—"}</p>
                                  </div>
                                </div>

                                {/* Metadata JSON */}
                                {s.metadata && Object.keys(s.metadata).length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-1">Metadata / IPN Payload</p>
                                    <pre className="bg-background border border-border rounded-lg p-3 text-[11px] font-mono overflow-x-auto max-h-64 whitespace-pre-wrap break-all">
                                      {JSON.stringify(s.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}

                                {/* Audit log entries */}
                                {audits.length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-1">Credit Audit Logs</p>
                                    <div className="space-y-1">
                                      {audits.map(a => (
                                        <div key={a.id} className="bg-background border border-border rounded-lg p-2 text-[11px]">
                                          <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="secondary" className="text-[10px]">{a.action}</Badge>
                                            <span className="text-muted-foreground">
                                              {format(new Date(a.created_at), "MMM dd HH:mm:ss")}
                                            </span>
                                          </div>
                                          {a.details && (
                                            <pre className="font-mono text-[10px] overflow-x-auto whitespace-pre-wrap break-all">
                                              {JSON.stringify(a.details, null, 2)}
                                            </pre>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

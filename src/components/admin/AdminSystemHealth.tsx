import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRealtimeStatus } from "@/hooks/use-realtime-status";
import { Activity, CheckCircle, AlertTriangle, Wifi, RefreshCw, Server } from "lucide-react";

interface HealthCheck {
  name: string;
  status: "ok" | "warn" | "error";
  detail: string;
}

export default function AdminSystemHealth() {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [recentErrors, setRecentErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { status: wsStatus } = useRealtimeStatus();

  const runChecks = useCallback(async () => {
    setLoading(true);
    const results: HealthCheck[] = [];

    // 1. DB connectivity
    const dbStart = Date.now();
    const { error: dbErr } = await supabase.from("profiles").select("id", { count: "exact", head: true });
    const dbMs = Date.now() - dbStart;
    results.push({
      name: "Database",
      status: dbErr ? "error" : dbMs > 2000 ? "warn" : "ok",
      detail: dbErr ? dbErr.message : `${dbMs}ms response`,
    });

    // 2. Realtime
    results.push({
      name: "Realtime WebSocket",
      status: wsStatus === "connected" ? "ok" : wsStatus === "connecting" ? "warn" : "error",
      detail: wsStatus,
    });

    // 3. Edge function health
    try {
      const start = Date.now();
      const res = await supabase.functions.invoke("check-api-status", { body: {} });
      const ms = Date.now() - start;
      results.push({
        name: "Edge Functions",
        status: res.error ? "error" : ms > 3000 ? "warn" : "ok",
        detail: res.error ? res.error.message : `${ms}ms response`,
      });
    } catch {
      results.push({ name: "Edge Functions", status: "error", detail: "Unreachable" });
    }

    // 4. Recent error count
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count } = await supabase.from("audit_logs").select("id", { count: "exact", head: true })
      .gte("created_at", hourAgo).or("action.ilike.%error%,action.ilike.%fail%");
    results.push({
      name: "Error Rate (1h)",
      status: (count ?? 0) > 10 ? "error" : (count ?? 0) > 3 ? "warn" : "ok",
      detail: `${count ?? 0} error events`,
    });

    setChecks(results);

    // Load recent error logs
    const { data: errLogs } = await supabase.from("audit_logs").select("id, action, entity_type, created_at, actor_id")
      .or("action.ilike.%error%,action.ilike.%fail%").order("created_at", { ascending: false }).limit(20);
    setRecentErrors(errLogs ?? []);

    setLoading(false);
  }, [wsStatus]);

  useEffect(() => { runChecks(); }, [runChecks]);

  const statusIcon = (s: string) => s === "ok" ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : s === "warn" ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : <AlertTriangle className="w-4 h-4 text-destructive" />;
  const overallStatus = checks.some(c => c.status === "error") ? "Degraded" : checks.some(c => c.status === "warn") ? "Warning" : "Healthy";

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${overallStatus === "Healthy" ? "bg-emerald-500/10" : overallStatus === "Warning" ? "bg-amber-500/10" : "bg-destructive/10"}`}>
            <Server className={`w-5 h-5 ${overallStatus === "Healthy" ? "text-emerald-500" : overallStatus === "Warning" ? "text-amber-500" : "text-destructive"}`} />
          </div>
          <div><p className="text-xs text-muted-foreground">System</p><p className="text-lg font-bold text-foreground">{overallStatus}</p></div>
        </CardContent></Card>
        {checks.map(c => (
          <Card key={c.name}><CardContent className="p-4 flex items-center gap-3">
            {statusIcon(c.status)}
            <div><p className="text-xs text-muted-foreground">{c.name}</p><p className="text-sm font-medium text-foreground">{c.detail}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" />Recent Errors</CardTitle>
          <Button variant="ghost" size="icon" onClick={runChecks}><RefreshCw className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[350px]">
            {recentErrors.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-8">No recent errors 🎉</p>
            ) : (
              <div className="divide-y divide-border/50">
                {recentErrors.map(e => (
                  <div key={e.id} className="px-4 py-2.5 flex items-center gap-3">
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{e.action.replace(/_/g, " ")}</p>
                      <p className="text-[10px] text-muted-foreground">{e.entity_type || "system"} · {new Date(e.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

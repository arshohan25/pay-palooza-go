import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, SkipForward, Loader2, RefreshCw, Play } from "lucide-react";
import { toast } from "sonner";

interface LogRow {
  id: string;
  request_id: string | null;
  invoice_id: string | null;
  status: string; // credited | skipped | error
  detail: any;
  created_at: string;
}

// Group log rows into "runs" — rows created within 60s of each other.
function bucketRuns(rows: LogRow[]) {
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const runs: { start: string; end: string; rows: LogRow[] }[] = [];
  for (const r of sorted) {
    const last = runs[runs.length - 1];
    if (last && new Date(r.created_at).getTime() - new Date(last.end).getTime() <= 60_000) {
      last.rows.push(r);
      last.end = r.created_at;
    } else {
      runs.push({ start: r.created_at, end: r.created_at, rows: [r] });
    }
  }
  return runs.reverse();
}

export default function AdminReconcileRuns() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("addmoney_reconciliation_log")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) toast.error(error.message);
    setRows((data as LogRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("addmoney-recon-log")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "addmoney_reconciliation_log" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const triggerRun = async () => {
    setTriggering(true);
    try {
      const { data, error } = await supabase.functions.invoke("reconcile-addmoney", { body: {} });
      if (error) throw error;
      const scanned = (data as any)?.scanned ?? 0;
      toast.success(`Reconciliation run finished · scanned ${scanned}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Reconciliation failed");
    } finally {
      setTriggering(false);
    }
  };

  const runs = useMemo(() => bucketRuns(rows), [rows]);
  const totals = useMemo(() => {
    const t = { credited: 0, skipped: 0, error: 0 };
    for (const r of rows) {
      if (r.status === "credited") t.credited++;
      else if (r.status === "skipped") t.skipped++;
      else t.error++;
    }
    return t;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold">Add-Money Reconciliation Runs</h2>
          <p className="text-xs text-muted-foreground">Last 7 days · scheduled every 15 min</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={`mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={triggerRun} disabled={triggering} className="bg-primary hover:bg-primary/90">
            {triggering ? <Loader2 size={14} className="animate-spin mr-1" /> : <Play size={14} className="mr-1" />}
            Run now
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Credited</p>
          <p className="text-xl font-bold text-emerald-600">{totals.credited}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Skipped</p>
          <p className="text-xl font-bold text-amber-600">{totals.skipped}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Errors</p>
          <p className="text-xl font-bold text-red-600">{totals.error}</p>
        </CardContent></Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="animate-spin" /></div>
      ) : runs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No reconciliation activity in the last 7 days.</p>
      ) : (
        <div className="space-y-3">
          {runs.map((run, i) => {
            const credited = run.rows.filter(r => r.status === "credited").length;
            const skipped = run.rows.filter(r => r.status === "skipped").length;
            const errored = run.rows.filter(r => r.status === "error");
            return (
              <Card key={i}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-sm font-semibold">
                      {new Date(run.end).toLocaleString()}
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 gap-1">
                        <CheckCircle2 size={11} /> {credited} credited
                      </Badge>
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 gap-1">
                        <SkipForward size={11} /> {skipped} skipped
                      </Badge>
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 gap-1">
                        <AlertCircle size={11} /> {errored.length} errors
                      </Badge>
                      <Badge variant="outline">{run.rows.length} verified</Badge>
                    </div>
                  </div>
                  {errored.length > 0 && (
                    <div className="text-xs bg-red-50 dark:bg-red-950/30 rounded p-2 space-y-1">
                      {errored.slice(0, 5).map(e => (
                        <p key={e.id} className="font-mono truncate">
                          <span className="text-muted-foreground">{e.invoice_id ?? e.request_id?.slice(0, 8)}:</span>{" "}
                          {e.detail?.error ?? "unknown error"}
                        </p>
                      ))}
                      {errored.length > 5 && (
                        <p className="text-muted-foreground">+{errored.length - 5} more</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

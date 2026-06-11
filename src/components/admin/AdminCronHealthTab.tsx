import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, CheckCircle2, PlayCircle, RefreshCw, ShieldAlert, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";

type Snapshot = {
  generated_at: string;
  stats_24h: { success_24h: number; err_401_24h: number; err_5xx_24h: number; last_success_at: string | null; last_error_at: string | null };
  stats_7d: { success_7d: number; err_401_7d: number; err_5xx_7d: number };
  hourly: Array<{ hour: string; ok: number; err: number }>;
  stalled_count: number;
  schedules: Array<{
    id: string; user_id: string; phone: string | null; name: string | null;
    frequency: string; amount: number;
    next_run_at: string | null; last_run_at: string | null;
    is_active: boolean; settled: boolean;
    total_paid: number | null; total_installments: number | null; missed_count: number | null;
    hours_overdue: number | null; is_stalled: boolean;
    last_outcome: string | null; last_outcome_at: string | null;
  }>;
};

type BackfillResult = {
  processed: number; skipped: number; settled: number; missed: number; dedup: number; total: number;
  perSchedule: Array<{ schedule_id: string; outcome: string; cycles?: number }>;
};

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AdminCronHealthTab() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);

  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase.rpc as any)("get_cron_health_snapshot");
    if (error) toast.error(error.message);
    else setSnap(data as Snapshot);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSnapshot(); }, [fetchSnapshot]);

  // Realtime: refresh when new log rows arrive
  useEffect(() => {
    const ch = supabase
      .channel("admin-cron-health")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cron_invocation_log" } as any, () => fetchSnapshot())
      .on("postgres_changes", { event: "*", schema: "public", table: "savings_auto_save" }, () => fetchSnapshot())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchSnapshot]);

  const runBackfill = async () => {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("process-auto-save", { body: { mode: "backfill", force: true } });
      if (error) throw error;
      setBackfillResult(data as BackfillResult);
      toast.success(`Backfill complete: ${(data as any).processed} processed, ${(data as any).settled} settled, ${(data as any).missed} missed`);
      fetchSnapshot();
    } catch (e: any) {
      toast.error(e?.message ?? "Backfill failed");
    } finally {
      setBackfilling(false);
    }
  };

  if (loading || !snap) {
    return <p className="text-sm text-muted-foreground">Loading cron health…</p>;
  }

  const s = snap.stats_24h;
  const stalledSchedules = snap.schedules.filter((x) => x.is_stalled);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold text-foreground">Cron health</h3>
          <p className="text-[11px] text-muted-foreground">
            Snapshot generated {relTime(snap.generated_at)} • updates in realtime
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchSnapshot}>
            <RefreshCw size={14} className="mr-1" />Refresh
          </Button>
          <Button size="sm" onClick={runBackfill} disabled={backfilling}>
            <PlayCircle size={14} className="mr-1" />
            {backfilling ? "Backfilling…" : "Backfill stale plans"}
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-sm font-bold text-foreground">{relTime(s.last_success_at)}</p>
          <p className="text-[11px] text-muted-foreground">Last successful run</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <ShieldAlert className="w-5 h-5 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{s.err_401_24h}</p>
          <p className="text-[11px] text-muted-foreground">401s (24h)</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{s.err_5xx_24h}</p>
          <p className="text-[11px] text-muted-foreground">5xx (24h)</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <Clock className="w-5 h-5 text-destructive mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{snap.stalled_count}</p>
          <p className="text-[11px] text-muted-foreground">Stalled schedules</p>
        </CardContent></Card>
      </div>

      {/* Hourly bar chart */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Activity size={14} className="text-primary" /> Invocations per hour (24h)
            </h4>
            <p className="text-[11px] text-muted-foreground">
              7d: {snap.stats_7d.success_7d} ok • {snap.stats_7d.err_401_7d} 401 • {snap.stats_7d.err_5xx_7d} 5xx
            </p>
          </div>
          {snap.hourly.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">No invocations in the last 24 hours.</p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={snap.hourly}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="hour" tickFormatter={(v) => new Date(v).getHours() + "h"} fontSize={10} />
                  <YAxis allowDecimals={false} fontSize={10} />
                  <Tooltip
                    labelFormatter={(v) => new Date(v as string).toLocaleString()}
                    contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  />
                  <Bar dataKey="ok" stackId="a" fill="hsl(var(--primary))" />
                  <Bar dataKey="err" stackId="a" fill="hsl(var(--destructive))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backfill result panel */}
      {backfillResult && (
        <Card className="border-0 shadow-sm bg-primary/5">
          <CardContent className="p-4 space-y-2">
            <h4 className="text-sm font-bold text-foreground">Backfill result</h4>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge className="bg-emerald-100 text-emerald-700">processed {backfillResult.processed}</Badge>
              <Badge className="bg-primary/10 text-primary">settled {backfillResult.settled}</Badge>
              <Badge className="bg-destructive/10 text-destructive">missed {backfillResult.missed}</Badge>
              <Badge variant="secondary">skipped {backfillResult.skipped}</Badge>
              <Badge variant="secondary">total {backfillResult.total}</Badge>
            </div>
            <div className="max-h-44 overflow-auto mt-2">
              {backfillResult.perSchedule.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] py-0.5">
                  <code className="text-muted-foreground">{p.schedule_id.substring(0, 8)}</code>
                  <Badge variant="outline" className="text-[10px]">{p.outcome}</Badge>
                  {p.cycles ? <span className="text-muted-foreground">×{p.cycles} cycles</span> : null}
                </div>
              ))}
              {backfillResult.perSchedule.length === 0 && (
                <p className="text-xs text-muted-foreground">No schedules were overdue by more than 24h.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stalled schedules table */}
      {stalledSchedules.length > 0 && (
        <Card className="border border-destructive/30 shadow-sm">
          <CardContent className="p-4">
            <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <AlertTriangle size={14} className="text-destructive" /> Stalled schedules ({stalledSchedules.length})
            </h4>
            <div className="space-y-2 max-h-64 overflow-auto">
              {stalledSchedules.map((sc) => (
                <div key={sc.id} className="flex items-center justify-between gap-2 text-xs border-l-2 border-destructive pl-3 py-1">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{sc.name ?? sc.phone ?? sc.user_id.substring(0, 8)}</p>
                    <p className="text-muted-foreground">
                      ৳{Number(sc.amount).toLocaleString()}/{sc.frequency} • next_run_at {sc.next_run_at ? new Date(sc.next_run_at).toLocaleString() : "—"}
                    </p>
                    {sc.last_outcome && (
                      <p className="text-muted-foreground">last: <Badge variant="outline" className="text-[10px]">{sc.last_outcome}</Badge> {relTime(sc.last_outcome_at)}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className="bg-destructive/10 text-destructive text-[10px]">
                      {sc.hours_overdue ? `${Math.floor(sc.hours_overdue)}h overdue` : "stalled"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

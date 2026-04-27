import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, RefreshCw, Database, Loader2, CheckCircle2, AlertCircle, Activity } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type SnapshotRow = {
  id: string;
  snapshot_date: string;
  generated_at: string;
  generated_by: string | null;
  cohorts: any;
  predictive: any;
  ops_wall: any;
  totals: any;
};

const FN_PATH = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-metrics-snapshot`;

const fmtNum = (n: any) => (typeof n === "number" ? n.toLocaleString() : n ?? "—");
const fmtCurrency = (n: any) => (typeof n === "number" ? `৳${n.toLocaleString()}` : n ?? "—");
const fmtPct = (n: any) => (typeof n === "number" ? `${n}%` : n ?? "—");

function MetricTile({ label, value, hint }: { label: string; value: any; hint?: string }) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function AdminMetricsSnapshots() {
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"snapshot" | "backfill" | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase
      .from("admin_daily_metrics_snapshots" as any) as any)
      .select("*")
      .order("snapshot_date", { ascending: false })
      .limit(60);
    if (error) toast.error("Failed to load snapshots");
    setRows((data ?? []) as SnapshotRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Auto-backfill on first ever view
  useEffect(() => {
    if (loading) return;
    if (rows.length === 0) {
      // fire and forget; user sees the result after refresh
      runBackfill(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  async function callFn(body: any) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(FN_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Request failed");
    return json;
  }

  async function runSnapshot() {
    setBusy("snapshot");
    try {
      const date = selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined;
      await callFn({ action: "snapshot", date });
      toast.success(`Snapshot saved for ${date}`);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function runBackfill(silent = false) {
    setBusy("backfill");
    try {
      await callFn({ action: "backfill", days: 30 });
      if (!silent) toast.success("30-day backfill complete");
      await load();
    } catch (e: any) {
      if (!silent) toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  const selectedKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const snapshot = useMemo(
    () => rows.find((r) => r.snapshot_date === selectedKey) ?? rows[0],
    [rows, selectedKey],
  );

  const datesWithSnapshots = useMemo(
    () => new Set(rows.map((r) => r.snapshot_date)),
    [rows],
  );

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start gap-2", !selectedDate && "text-muted-foreground")}>
                <CalendarIcon className="h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(d) => d > new Date()}
                modifiers={{ hasSnapshot: (d) => datesWithSnapshots.has(format(d, "yyyy-MM-dd")) }}
                modifiersClassNames={{ hasSnapshot: "ring-2 ring-primary/50 rounded-md" }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <Button onClick={runSnapshot} disabled={busy !== null} className="gap-2">
            {busy === "snapshot" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Snapshot now
          </Button>
          <Button variant="outline" onClick={() => runBackfill(false)} disabled={busy !== null} className="gap-2">
            {busy === "backfill" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Backfill 30 days
          </Button>

          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{rows.length} stored</Badge>
            {snapshot && (
              <span>
                Showing {snapshot.snapshot_date} · generated {format(new Date(snapshot.generated_at), "PPp")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading snapshots…</p>
      ) : !snapshot ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          No snapshot available for this date yet. Click <strong>Snapshot now</strong> to capture one.
        </CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Headline totals</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <MetricTile label="Total Users" value={fmtNum(snapshot.totals?.total_users)} />
              <MetricTile label="Active Users" value={fmtNum(snapshot.totals?.active_users)} />
              <MetricTile label="Txn Volume (30d)" value={fmtCurrency(snapshot.totals?.txn_volume_30d)} hint={`${fmtNum(snapshot.totals?.txn_count_30d)} txns`} />
              <MetricTile label="Order Volume (30d)" value={fmtCurrency(snapshot.totals?.order_volume_30d)} hint={`${fmtNum(snapshot.totals?.order_count_30d)} orders`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Cohorts &amp; retention</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <MetricTile label="Day 1 retention" value={fmtPct(snapshot.cohorts?.day1?.rate)} hint={`${snapshot.cohorts?.day1?.retained ?? 0}/${snapshot.cohorts?.day1?.cohort ?? 0}`} />
              <MetricTile label="Day 7 retention" value={fmtPct(snapshot.cohorts?.day7?.rate)} hint={`${snapshot.cohorts?.day7?.retained ?? 0}/${snapshot.cohorts?.day7?.cohort ?? 0}`} />
              <MetricTile label="Day 30 retention" value={fmtPct(snapshot.cohorts?.day30?.rate)} hint={`${snapshot.cohorts?.day30?.retained ?? 0}/${snapshot.cohorts?.day30?.cohort ?? 0}`} />
              <MetricTile label="KYC completion" value={fmtPct(snapshot.cohorts?.kyc_completion)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Predictive signals</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <MetricTile label="Churn candidates (30d)" value={fmtNum(snapshot.predictive?.churn_candidates_30d)} hint="Active users with no transactions" />
              <MetricTile label="Inactive merchants" value={fmtNum(snapshot.predictive?.inactive_merchants)} />
              <MetricTile label="Low-float agents" value={fmtNum(snapshot.predictive?.low_float_agents)} hint="< ৳5,000 float" />
              <MetricTile label="Open fraud alerts" value={fmtNum(snapshot.predictive?.open_fraud_alerts)} />
              <MetricTile label="Pending KYC" value={fmtNum(snapshot.predictive?.pending_kyc)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Ops wall</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <MetricTile label="Gateway health" value={fmtPct(snapshot.ops_wall?.gateway_health_pct)} hint={`${snapshot.ops_wall?.gateways_healthy ?? 0}/${snapshot.ops_wall?.gateways_total ?? 0}`} />
              <MetricTile label="Recharge APIs" value={fmtPct(snapshot.ops_wall?.recharge_health_pct)} hint={`${snapshot.ops_wall?.recharge_apis_ok ?? 0}/${snapshot.ops_wall?.recharge_apis_total ?? 0}`} />
              <MetricTile label="Open complaints" value={fmtNum(snapshot.ops_wall?.open_complaints)} />
              <MetricTile label="Merchant spikes (>2σ)" value={fmtNum(snapshot.ops_wall?.merchant_spikes)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Recent snapshots</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {rows.slice(0, 30).map((r) => {
                  const active = r.snapshot_date === snapshot.snapshot_date;
                  return (
                    <Button
                      key={r.id}
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => setSelectedDate(new Date(`${r.snapshot_date}T12:00:00Z`))}
                    >
                      {r.snapshot_date}
                    </Button>
                  );
                })}
                {rows.length === 0 && <p className="text-sm text-muted-foreground">No snapshots yet.</p>}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

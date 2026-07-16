import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, PlayCircle, Radio, CheckCircle2, XCircle, Loader2, Database } from "lucide-react";
import { toast } from "sonner";

interface Metric {
  key: string;
  label: string;
  min: number;
  count: number | null;
  loading: boolean;
  error?: string;
}

/**
 * Admin-only page that shows live counts for reference-data tables that back
 * the merchant/agent/distributor flows, and runs the same threshold checks
 * as `scripts/check-seed-counts.mjs` in-browser. Counts refresh via Supabase
 * `postgres_changes` on `merchant_categories` and `unions` — no polling.
 */
export default function AdminSeedHealthPage() {
  const nav = useNavigate();
  const [metrics, setMetrics] = useState<Metric[]>([
    { key: "merchant_categories", label: "Active merchant categories", min: 20, count: null, loading: true },
    { key: "city_corporation", label: "City corporations", min: 12, count: null, loading: true },
    { key: "powrashava", label: "Powrashavas", min: 600, count: null, loading: true },
    { key: "union", label: "Union parishads", min: 4500, count: null, loading: true },
    { key: "unions_total", label: "Total unions rows", min: 5000, count: null, loading: true },
  ]);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [live, setLive] = useState(false);
  const seq = useRef(0);

  const fetchCount = useCallback(async (key: string) => {
    if (key === "merchant_categories") {
      const { count, error } = await (supabase as any)
        .from("merchant_categories")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      if (error) throw error;
      return count ?? 0;
    }
    if (key === "unions_total") {
      const { count, error } = await (supabase as any)
        .from("unions")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    }
    const { count, error } = await (supabase as any)
      .from("unions")
      .select("id", { count: "exact", head: true })
      .eq("type", key);
    if (error) throw error;
    return count ?? 0;
  }, []);

  const refreshAll = useCallback(async (silent = false) => {
    const mySeq = ++seq.current;
    if (!silent) {
      setMetrics((prev) => prev.map((m) => ({ ...m, loading: true, error: undefined })));
    }
    const results = await Promise.all(
      metrics.map(async (m) => {
        try {
          const n = await fetchCount(m.key);
          return { key: m.key, count: n as number, error: undefined as string | undefined };
        } catch (e: any) {
          return { key: m.key, count: null as number | null, error: e?.message ?? "error" };
        }
      }),
    );
    if (mySeq !== seq.current) return;
    setMetrics((prev) =>
      prev.map((m) => {
        const r = results.find((x) => x.key === m.key)!;
        return { ...m, count: r.count, error: r.error, loading: false };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCount]);

  useEffect(() => {
    refreshAll();
    const ch = supabase
      .channel("seed-health")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_categories" }, () => refreshAll(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "unions" }, () => refreshAll(true))
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runChecks = async () => {
    setRunning(true);
    await refreshAll();
    setRunning(false);
    setLastRun(new Date());
    const failed = metrics.filter((m) => m.count != null && m.count < m.min).length;
    if (failed === 0) toast.success("All seed counts healthy");
    else toast.error(`${failed} check(s) below threshold`);
  };

  const anyFailed = metrics.some((m) => m.count != null && m.count < m.min);
  const anyError = metrics.some((m) => m.error);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto space-y-3">
        <Button variant="ghost" onClick={() => nav(-1)} className="mb-1">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" /> Seed data health
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] gap-1">
                <Radio className={`w-3 h-3 ${live ? "text-green-500 animate-pulse" : "text-muted-foreground"}`} />
                {live ? "Live" : "Connecting…"}
              </Badge>
              <Button variant="ghost" size="icon" onClick={() => refreshAll()} aria-label="Refresh">
                <RefreshCw className={`w-4 h-4 ${metrics.some((m) => m.loading) ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Real-time counts for reference data that powers merchant / agent / distributor onboarding.
              Counts refresh automatically when rows change; use "Run checks" to re-validate thresholds.
            </p>

            <div className="space-y-2">
              {metrics.map((m) => {
                const ok = m.count != null && m.count >= m.min;
                return (
                  <div
                    key={m.key}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      m.error ? "bg-destructive/5 border-destructive/30" : ok ? "bg-card" : "bg-amber-500/5 border-amber-500/30"
                    }`}
                  >
                    {m.loading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : m.error ? (
                      <XCircle className="w-4 h-4 text-destructive" />
                    ) : ok ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-amber-600" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{m.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Expected ≥ {m.min.toLocaleString()}
                        {m.error && <span className="text-destructive"> — {m.error}</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold tabular-nums ${ok ? "" : m.error ? "text-destructive" : "text-amber-600"}`}>
                        {m.count == null ? "—" : m.count.toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t">
              <div className="text-[11px] text-muted-foreground">
                {lastRun ? `Last check: ${lastRun.toLocaleTimeString()}` : "Not run yet"}
                {" · "}
                {anyError ? (
                  <span className="text-destructive">Errors present</span>
                ) : anyFailed ? (
                  <span className="text-amber-600">Below threshold</span>
                ) : (
                  <span className="text-green-600">All healthy</span>
                )}
              </div>
              <Button onClick={runChecks} disabled={running}>
                {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
                Run checks
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

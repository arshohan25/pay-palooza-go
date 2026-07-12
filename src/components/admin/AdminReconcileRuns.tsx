import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  CheckCircle2,
  AlertCircle,
  SkipForward,
  Loader2,
  RefreshCw,
  Play,
  ChevronRight,
  CircleDot,
} from "lucide-react";
import { toast } from "sonner";

interface LogRow {
  id: string;
  request_id: string | null;
  invoice_id: string | null;
  status: string; // credited | skipped | error
  detail: any;
  created_at: string;
}

type StatusFilter = "all" | "credited" | "skipped" | "error";
type RunStatus = "idle" | "running" | "success" | "error";

interface Run {
  start: string;
  end: string;
  rows: LogRow[];
}

const PAGE_SIZE = 10;

function bucketRuns(rows: LogRow[]): Run[] {
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const runs: Run[] = [];
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
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [runMessage, setRunMessage] = useState<string>("");
  const runLock = useRef(false);

  // filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [errorOnly, setErrorOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState(1);

  // details drawer
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("addmoney_reconciliation_log")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) toast.error(error.message);
    setRows((data as LogRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("addmoney-recon-log")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "addmoney_reconciliation_log" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const triggerRun = async () => {
    if (runLock.current || triggering) {
      toast.info("A reconciliation run is already in progress");
      return;
    }
    runLock.current = true;
    setTriggering(true);
    setRunStatus("running");
    setRunMessage("Reconciliation run in progress…");
    try {
      const { data, error } = await supabase.functions.invoke("reconcile-addmoney", { body: {} });
      if (error) throw error;
      const scanned = (data as any)?.scanned ?? 0;
      const results: any[] = (data as any)?.results ?? [];
      const errored = results.filter((r) => r.action === "error").length;
      if (errored > 0) {
        setRunStatus("error");
        setRunMessage(`Finished with ${errored} error${errored === 1 ? "" : "s"} · scanned ${scanned}`);
        toast.error(`Reconciliation finished with ${errored} errors`);
      } else {
        setRunStatus("success");
        setRunMessage(`Finished cleanly · scanned ${scanned}`);
        toast.success(`Reconciliation run finished · scanned ${scanned}`);
      }
      await load();
    } catch (e: any) {
      setRunStatus("error");
      setRunMessage(e.message || "Reconciliation failed");
      toast.error(e.message || "Reconciliation failed");
    } finally {
      setTriggering(false);
      runLock.current = false;
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (errorOnly && r.status !== "error") return false;
      if (!errorOnly && statusFilter !== "all" && r.status !== statusFilter) return false;
      if (dateFrom && r.created_at < new Date(dateFrom).toISOString()) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (r.created_at > end.toISOString()) return false;
      }
      return true;
    });
  }, [rows, statusFilter, errorOnly, dateFrom, dateTo]);

  const runs = useMemo(() => {
    const all = bucketRuns(filteredRows);
    if (errorOnly) return all.filter((r) => r.rows.some((x) => x.status === "error"));
    return all;
  }, [filteredRows, errorOnly]);

  const pagedRuns = useMemo(
    () => runs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [runs, page],
  );
  const totalPages = Math.max(1, Math.ceil(runs.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [statusFilter, errorOnly, dateFrom, dateTo]);

  const totals = useMemo(() => {
    const t = { credited: 0, skipped: 0, error: 0 };
    for (const r of filteredRows) {
      if (r.status === "credited") t.credited++;
      else if (r.status === "skipped") t.skipped++;
      else t.error++;
    }
    return t;
  }, [filteredRows]);

  const statusPill = () => {
    if (runStatus === "idle") return null;
    const cfg = {
      running: { cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: <Loader2 size={12} className="animate-spin" /> },
      success: { cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: <CheckCircle2 size={12} /> },
      error: { cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: <AlertCircle size={12} /> },
    }[runStatus];
    return (
      <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${cfg.cls}`} role="status" aria-live="polite">
        {cfg.icon}
        <span>{runMessage}</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold">Add-Money Reconciliation Runs</h2>
          <p className="text-xs text-muted-foreground">Last 30 days · scheduled every 15 min</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {statusPill()}
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={`mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={triggerRun}
            disabled={triggering}
            aria-disabled={triggering}
            className="bg-primary hover:bg-primary/90"
          >
            {triggering ? <Loader2 size={14} className="animate-spin mr-1" /> : <Play size={14} className="mr-1" />}
            {triggering ? "Running…" : "Run now"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">From</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs w-[140px]" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">To</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs w-[140px]" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Status</label>
            <div className="flex gap-1">
              {(["all", "credited", "skipped", "error"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  disabled={errorOnly && s !== "error"}
                  className={`px-2 py-1 rounded text-[11px] border capitalize ${
                    statusFilter === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground"
                  } disabled:opacity-40`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer ml-2">
            <input type="checkbox" checked={errorOnly} onChange={(e) => setErrorOnly(e.target.checked)} />
            Errors only
          </label>
          {(dateFrom || dateTo || statusFilter !== "all" || errorOnly) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setDateFrom(""); setDateTo(""); setStatusFilter("all"); setErrorOnly(false); }}
              className="text-xs h-8"
            >
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

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
        <p className="text-sm text-muted-foreground text-center py-8">No reconciliation activity matches these filters.</p>
      ) : (
        <>
          <div className="space-y-3">
            {pagedRuns.map((run, i) => {
              const credited = run.rows.filter(r => r.status === "credited").length;
              const skipped = run.rows.filter(r => r.status === "skipped").length;
              const errored = run.rows.filter(r => r.status === "error");
              return (
                <Card key={run.start + i} className="cursor-pointer hover:border-primary/50 transition" onClick={() => setSelectedRun(run)}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-sm font-semibold">{new Date(run.end).toLocaleString()}</p>
                      <div className="flex gap-1.5 flex-wrap items-center">
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
                        <ChevronRight size={14} className="text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · {runs.length} runs
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Run details drawer */}
      <Sheet open={!!selectedRun} onOpenChange={(open) => !open && setSelectedRun(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Reconciliation Run Details</SheetTitle>
            {selectedRun && (
              <SheetDescription>
                {new Date(selectedRun.start).toLocaleString()} — {new Date(selectedRun.end).toLocaleString()} ·{" "}
                {selectedRun.rows.length} invoices
              </SheetDescription>
            )}
          </SheetHeader>
          {selectedRun && (
            <div className="mt-4 space-y-2">
              {selectedRun.rows.map((r) => {
                const isError = r.status === "error";
                const isCredited = r.status === "credited";
                const verifyStatus = r.detail?.verify_status ?? (isCredited ? "COMPLETED" : "—");
                const errMsg = r.detail?.error;
                const newBal = r.detail?.new_balance ?? r.detail?.addmoney?.new_balance;
                return (
                  <div
                    key={r.id}
                    className={`rounded border p-3 text-xs space-y-1 ${
                      isError
                        ? "border-red-300 bg-red-50 dark:bg-red-950/30"
                        : isCredited
                        ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30"
                        : "border-amber-300 bg-amber-50 dark:bg-amber-950/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-mono truncate">
                        <span className="text-muted-foreground">invoice:</span> {r.invoice_id ?? "—"}
                      </p>
                      <Badge variant="outline" className="capitalize">
                        <CircleDot size={10} className="mr-1" /> {r.status}
                      </Badge>
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground truncate">
                      request: {r.request_id ?? "—"}
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Verification</p>
                        <p className="font-medium">{verifyStatus}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Credit action</p>
                        <p className="font-medium">
                          {isCredited ? "Credited" : isError ? "Failed" : "No-op"}
                          {newBal != null && ` · new balance ${newBal}`}
                        </p>
                      </div>
                    </div>
                    {errMsg && (
                      <p className="text-red-700 dark:text-red-300 font-mono break-all pt-1">
                        error: {errMsg}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground pt-1">
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

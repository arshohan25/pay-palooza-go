import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Coins, Clock, CheckCircle, RefreshCw, AlertTriangle, Play, History, Search, Repeat, X } from "lucide-react";
import { toast } from "sonner";

type Schedule = any;
type RunLog = {
  id: string;
  schedule_id: string;
  user_id: string;
  outcome: string;
  reason: string | null;
  amount: number;
  triggered_by: string;
  created_at: string;
};

const OUTCOME_COLOR: Record<string, string> = {
  collected: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  missed: "bg-destructive/10 text-destructive",
  settled: "bg-primary/10 text-primary",
  dedup_skipped: "bg-muted text-muted-foreground",
  no_goal: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  schedule_inactive: "bg-muted text-muted-foreground",
};

export default function AdminAutoSaveMonitor() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [runLogs, setRunLogs] = useState<RunLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [freqFilter, setFreqFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<Schedule | null>(null);
  const [drawerLogs, setDrawerLogs] = useState<RunLog[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: scheds }, { data: logs }] = await Promise.all([
      supabase.from("savings_auto_save").select("*").order("created_at", { ascending: false }).limit(500),
      (supabase.from as any)("dps_run_log").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setSchedules(scheds ?? []);
    setRunLogs((logs as RunLog[]) ?? []);

    const uids = [...new Set((scheds ?? []).map((d: any) => d.user_id))];
    if (uids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("user_id, name, phone").in("user_id", uids);
      const map: Record<string, any> = {};
      (profs ?? []).forEach((p) => { map[p.user_id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime refresh
  useEffect(() => {
    const ch = supabase
      .channel("admin-dps-monitor")
      .on("postgres_changes", { event: "*", schema: "public", table: "savings_auto_save" }, () => fetchAll())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dps_run_log" } as any, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  const toggleActive = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from("savings_auto_save").update({ is_active, updated_at: new Date().toISOString() } as any).eq("id", id);
    if (error) toast.error(error.message);
    else await fetchAll();
  };

  const runOne = async (schedule_id: string, force = true) => {
    setRunning(schedule_id);
    try {
      const { data, error } = await supabase.functions.invoke("process-auto-save", { body: { schedule_id, force } });
      if (error) throw error;
      const r = data as any;
      const out = r?.perSchedule?.[0]?.outcome ?? "done";
      toast.success(`Run complete: ${out}`);
      await fetchAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Run failed");
    } finally {
      setRunning(null);
    }
  };

  const runAllDue = async () => {
    setBulkRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-auto-save", { body: {} });
      if (error) throw error;
      const r = data as any;
      toast.success(`Cron tick: processed ${r?.processed ?? 0}, missed ${r?.missed ?? 0}, dedup ${r?.dedup ?? 0}, settled ${r?.settled ?? 0}`);
      await fetchAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Run failed");
    } finally {
      setBulkRunning(false);
    }
  };

  const openDrawer = async (s: Schedule) => {
    setDrawer(s);
    const { data } = await (supabase.from as any)("dps_run_log")
      .select("*").eq("schedule_id", s.id).order("created_at", { ascending: false }).limit(50);
    setDrawerLogs((data as RunLog[]) ?? []);
  };

  const filtered = useMemo(() => {
    return schedules.filter((s) => {
      if (statusFilter === "active" && (!s.is_active || s.settled)) return false;
      if (statusFilter === "paused" && (s.is_active || s.settled)) return false;
      if (statusFilter === "settled" && !s.settled) return false;
      if (statusFilter === "at_risk" && (s.missed_count ?? 0) < 3) return false;
      if (freqFilter !== "all" && s.frequency !== freqFilter) return false;
      if (search.trim()) {
        const p = profiles[s.user_id];
        const q = search.toLowerCase();
        if (!p) return false;
        if (!(p.name ?? "").toLowerCase().includes(q) && !(p.phone ?? "").includes(q)) return false;
      }
      return true;
    });
  }, [schedules, profiles, statusFilter, freqFilter, search]);

  const active = schedules.filter((s) => s.is_active && !s.settled);
  const settled = schedules.filter((s) => s.settled);
  const totalCycle = active.reduce((sum, s) => sum + Number(s.amount), 0);
  const dueIn24h = active.filter((s) => s.next_run_at && new Date(s.next_run_at).getTime() < Date.now() + 86400000);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const missedToday = runLogs.filter((l) => l.outcome === "missed" && new Date(l.created_at) >= todayStart);
  const lastRun = runLogs[0]?.created_at;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold text-foreground">DPS Operations Monitor</h3>
          {lastRun && <p className="text-[11px] text-muted-foreground">Last processed: {new Date(lastRun).toLocaleString()}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAll}><RefreshCw size={14} className="mr-1" />Refresh</Button>
          <Button size="sm" onClick={runAllDue} disabled={bulkRunning}>
            <Play size={14} className="mr-1" />{bulkRunning ? "Running…" : "Run cron tick"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <Coins className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{active.length}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{settled.length}</p>
          <p className="text-xs text-muted-foreground">Settled</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{missedToday.length}</p>
          <p className="text-xs text-muted-foreground">Missed today</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <Clock className="w-5 h-5 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{dueIn24h.length}</p>
          <p className="text-xs text-muted-foreground">Due in 24h</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <Coins className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-xl font-bold text-foreground">৳{totalCycle.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Per cycle</p>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search name or phone" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="settled">Settled</SelectItem>
            <SelectItem value="at_risk">At risk (3+ missed)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={freqFilter} onValueChange={setFreqFilter}>
          <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All freq</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No schedules match filters</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Freq</TableHead>
                <TableHead>Paid / Total</TableHead>
                <TableHead>Missed</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead>Next run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const p = profiles[s.user_id];
                const atRisk = (s.missed_count ?? 0) >= 3 && !s.settled;
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">{p?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{p?.phone ?? ""}</p>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">৳{Number(s.amount).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px] capitalize">{s.frequency}</Badge></TableCell>
                    <TableCell className="text-xs">{(s.total_paid ?? 0)} / {s.total_installments ?? "∞"}</TableCell>
                    <TableCell className={`text-xs font-semibold ${(s.missed_count ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}`}>{s.missed_count ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.last_run_at ? new Date(s.last_run_at).toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.next_run_at ? new Date(s.next_run_at).toLocaleString() : "—"}</TableCell>
                    <TableCell>
                      {s.settled ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px]">Settled</Badge>
                        : atRisk ? <Badge className="bg-destructive/10 text-destructive text-[10px]">At risk</Badge>
                        : s.is_active ? <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px]">Active</Badge>
                        : <Badge variant="secondary" className="text-[10px]">Paused</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openDrawer(s)} title="View timeline"><History size={14} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => runOne(s.id)} disabled={s.settled || running === s.id} title="Run now">
                          <Play size={14} className={running === s.id ? "animate-pulse" : ""} />
                        </Button>
                        <Switch checked={s.is_active} disabled={s.settled} onCheckedChange={(v) => toggleActive(s.id, v)} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-sm font-bold text-foreground">Recent processing runs</h4>
        {runLogs.length === 0 ? <p className="text-xs text-muted-foreground">No runs logged yet</p> : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Trigger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runLogs.map((l) => {
                  const p = profiles[l.user_id];
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{p?.name ?? p?.phone ?? l.user_id.substring(0, 8)}</TableCell>
                      <TableCell className="text-xs font-semibold">৳{Number(l.amount).toLocaleString()}</TableCell>
                      <TableCell><Badge className={`text-[10px] ${OUTCOME_COLOR[l.outcome] ?? "bg-muted text-muted-foreground"}`}>{l.outcome}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.reason ?? ""}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] capitalize">{l.triggered_by}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Sheet open={!!drawer} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Schedule timeline</SheetTitle>
          </SheetHeader>
          {drawer && (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="font-semibold">{profiles[drawer.user_id]?.name ?? drawer.user_id}</p>
                <p className="text-xs text-muted-foreground">{profiles[drawer.user_id]?.phone}</p>
                <p className="mt-2 text-xs">৳{Number(drawer.amount).toLocaleString()} / {drawer.frequency} • {drawer.total_paid ?? 0}/{drawer.total_installments ?? "∞"} paid • {drawer.missed_count ?? 0} missed</p>
              </div>
              <div className="space-y-2">
                {drawerLogs.length === 0 && <p className="text-xs text-muted-foreground">No history yet for this schedule.</p>}
                {drawerLogs.map((l) => (
                  <div key={l.id} className="flex items-start gap-3 text-xs border-l-2 border-border pl-3 py-1">
                    <Badge className={`text-[10px] ${OUTCOME_COLOR[l.outcome] ?? "bg-muted text-muted-foreground"}`}>{l.outcome}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">৳{Number(l.amount).toLocaleString()} <span className="text-muted-foreground capitalize">• {l.triggered_by}</span></p>
                      {l.reason && <p className="text-muted-foreground">{l.reason}</p>}
                      <p className="text-muted-foreground">{new Date(l.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

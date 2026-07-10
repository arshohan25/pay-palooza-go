import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, Play, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

type Category = "all" | "daily_summary" | "monthly_summary";
type Range = "24h" | "7d" | "30d" | "all";

interface NotifRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  category: string;
  metadata: any;
  created_at: string;
}

interface CronRow {
  id: string;
  function_name: string;
  triggered_by: string | null;
  status_code: number | null;
  processed: number | null;
  skipped: number | null;
  duration_ms: number | null;
  error_message: string | null;
  meta: any;
  created_at: string;
}

const rangeToStart = (r: Range) => {
  if (r === "all") return null;
  const ms = r === "24h" ? 86400000 : r === "7d" ? 7 * 86400000 : 30 * 86400000;
  return new Date(Date.now() - ms).toISOString();
};

export default function AdminSummaryNotifLog() {
  const [category, setCategory] = useState<Category>("all");
  const [range, setRange] = useState<Range>("7d");
  const [search, setSearch] = useState("");
  const [notifs, setNotifs] = useState<NotifRow[]>([]);
  const [crons, setCrons] = useState<CronRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoking, setInvoking] = useState(false);

  const load = async () => {
    setLoading(true);
    const start = rangeToStart(range);

    let nq = supabase
      .from("notifications")
      .select("id, user_id, title, body, category, metadata, created_at")
      .in("category", category === "all" ? ["daily_summary", "monthly_summary"] : [category])
      .order("created_at", { ascending: false })
      .limit(500);
    if (start) nq = nq.gte("created_at", start);

    let cq = supabase
      .from("cron_invocation_log")
      .select("id, function_name, triggered_by, status_code, processed, skipped, duration_ms, error_message, meta, created_at")
      .eq("function_name", "send-daily-summary")
      .order("created_at", { ascending: false })
      .limit(200);
    if (start) cq = cq.gte("created_at", start);

    const [n, c] = await Promise.all([nq, cq]);
    if (n.error) toast.error(n.error.message);
    if (c.error) toast.error(c.error.message);
    setNotifs((n.data ?? []) as NotifRow[]);
    setCrons((c.data ?? []) as CronRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [category, range]);

  const filteredNotifs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notifs;
    return notifs.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.body.toLowerCase().includes(q) ||
      n.user_id.toLowerCase().includes(q)
    );
  }, [notifs, search]);

  const stats = useMemo(() => ({
    total: notifs.length,
    daily: notifs.filter(n => n.category === "daily_summary").length,
    monthly: notifs.filter(n => n.category === "monthly_summary").length,
    cronRuns: crons.length,
    cronErrors: crons.filter(c => (c.status_code ?? 0) >= 400 || c.error_message).length,
  }), [notifs, crons]);

  const forceInvoke = async () => {
    setInvoking(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-daily-summary", { body: { force: 1 } });
      if (error) throw error;
      toast.success(`Invoked: ${JSON.stringify(data)}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Invocation failed");
    } finally {
      setInvoking(false);
    }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString("en-BD", { hour12: false });

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All summaries</SelectItem>
            <SelectItem value="daily_summary">Daily summary</SelectItem>
            <SelectItem value="monthly_summary">Monthly summary</SelectItem>
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={(v) => setRange(v as Range)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Search title / body / user id"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Reload
          </Button>
          <Button size="sm" onClick={forceInvoke} disabled={invoking}>
            {invoking ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />}
            Force run now
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total notif.", value: stats.total },
          { label: "Daily", value: stats.daily },
          { label: "Monthly", value: stats.monthly },
          { label: "Cron runs", value: stats.cronRuns },
          { label: "Cron errors", value: stats.cronErrors, tone: stats.cronErrors > 0 ? "text-destructive" : "" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className={`text-2xl font-bold tabular-nums mt-0.5 ${s.tone ?? ""}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Cron runs */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <div className="font-semibold text-sm flex items-center gap-2">
            <Clock className="w-4 h-4" /> Cron invocations · send-daily-summary
          </div>
          <div className="text-xs text-muted-foreground">{crons.length} runs</div>
        </div>
        <div className="max-h-[300px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">When</th>
                <th className="text-left px-3 py-2">Trigger</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Processed</th>
                <th className="text-right px-3 py-2">Skipped</th>
                <th className="text-right px-3 py-2">Duration</th>
                <th className="text-left px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {crons.length === 0 && (
                <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">
                  {loading ? "Loading…" : "No cron runs in range"}
                </td></tr>
              )}
              {crons.map(c => {
                const ok = (c.status_code ?? 0) >= 200 && (c.status_code ?? 0) < 400 && !c.error_message;
                const note = c.error_message
                  ?? (c.meta?.skipped ?? c.meta?.reason ?? (c.meta ? JSON.stringify(c.meta).slice(0, 80) : ""));
                return (
                  <tr key={c.id} className="border-t border-border/60 hover:bg-muted/20">
                    <td className="px-3 py-2 tabular-nums text-xs">{fmt(c.created_at)}</td>
                    <td className="px-3 py-2 text-xs">{c.triggered_by ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                        ok
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          : "bg-destructive/10 text-destructive border-destructive/30"
                      }`}>
                        {ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {c.status_code ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.processed ?? 0}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.skipped ?? 0}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">{c.duration_ms != null ? `${c.duration_ms}ms` : "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[280px]">{note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notifications inserted */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <div className="font-semibold text-sm">Summary notifications inserted</div>
          <div className="text-xs text-muted-foreground">{filteredNotifs.length} of {notifs.length}</div>
        </div>
        <div className="max-h-[500px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">When</th>
                <th className="text-left px-3 py-2">Category</th>
                <th className="text-left px-3 py-2">Title</th>
                <th className="text-left px-3 py-2">Body</th>
                <th className="text-left px-3 py-2">User</th>
                <th className="text-left px-3 py-2">Period</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotifs.length === 0 && (
                <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">
                  {loading ? "Loading…" : "No notifications in range"}
                </td></tr>
              )}
              {filteredNotifs.map(n => (
                <tr key={n.id} className="border-t border-border/60 hover:bg-muted/20">
                  <td className="px-3 py-2 tabular-nums text-xs whitespace-nowrap">{fmt(n.created_at)}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      n.category === "monthly_summary"
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                    }`}>
                      {n.category === "monthly_summary" ? "MONTHLY" : "DAILY"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">{n.title}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{n.body}</td>
                  <td className="px-3 py-2 text-[10px] font-mono text-muted-foreground">{n.user_id.slice(0, 8)}…</td>
                  <td className="px-3 py-2 text-[11px] tabular-nums">{n.metadata?.month ?? n.metadata?.date ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

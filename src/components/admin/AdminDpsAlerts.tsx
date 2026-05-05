import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Wand2, Undo2, CheckCircle2, BellRing } from "lucide-react";
import { toast } from "sonner";

type Alert = {
  id: string;
  schedule_id: string;
  user_id: string;
  outcome: string;
  reason: string | null;
  amount: number;
  created_at: string;
  goal_id: string | null;
  goal_name: string | null;
  tx_reference: string | null;
  transaction_id: string | null;
  resolved?: boolean;
};

const isAlertOutcome = (o: string) => o === "no_goal";

export default function AdminDpsAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  const loadProfiles = useCallback(async (uids: string[]) => {
    if (!uids.length) return;
    const { data } = await supabase.from("profiles").select("user_id, name, phone").in("user_id", uids);
    setProfiles((prev) => {
      const next = { ...prev };
      (data ?? []).forEach((p) => { next[p.user_id] = p; });
      return next;
    });
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.from as any)("dps_run_log")
      .select("*")
      .eq("outcome", "no_goal")
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = (data as Alert[]) ?? [];
    rows.forEach((r) => seenIds.current.add(r.id));
    setAlerts(rows);
    await loadProfiles([...new Set(rows.map((r) => r.user_id))]);
    setLoading(false);
  }, [loadProfiles]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime: catch new no_goal entries and toast immediately
  useEffect(() => {
    const ch = supabase
      .channel("admin-dps-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dps_run_log" } as any,
        (payload: any) => {
          const row = payload.new as Alert;
          if (!isAlertOutcome(row.outcome)) return;
          if (seenIds.current.has(row.id)) return;
          seenIds.current.add(row.id);
          setAlerts((prev) => [row, ...prev].slice(0, 200));
          loadProfiles([row.user_id]);
          toast.warning("DPS alert: schedule has no linked goal", {
            description: row.reason ?? "no_goal",
            duration: 8000,
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadProfiles]);

  const markResolved = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, resolved: true } : a)));
  };

  // Safe re-run: create a holding goal (if needed), link to schedule, then invoke EF with force=true.
  const safeRerun = async (alert: Alert) => {
    setBusy(alert.id);
    try {
      // Re-fetch schedule to get latest state
      const { data: schedule, error: sErr } = await supabase
        .from("savings_auto_save").select("*").eq("id", alert.schedule_id).single();
      if (sErr) throw sErr;
      if (!schedule) throw new Error("Schedule not found");

      let goalId = (schedule as any).goal_id as string | null;

      // If still no goal_id, or goal is inactive, create a holding "DPS Plan" goal and link.
      let needsLink = !goalId;
      if (goalId) {
        const { data: g } = await supabase.from("savings_goals").select("id, status").eq("id", goalId).maybeSingle();
        if (!g || g.status !== "active") needsLink = true;
      }
      if (needsLink) {
        const totalInst = (schedule as any).total_installments ?? 12;
        const target = Number((schedule as any).amount) * Number(totalInst > 0 ? totalInst : 12);
        const { data: holding, error: gErr } = await supabase
          .from("savings_goals")
          .insert({
            user_id: alert.user_id,
            name: "DPS Plan (admin recovery)",
            emoji: "💰",
            target_amount: target,
          } as any)
          .select("id").single();
        if (gErr) throw gErr;
        goalId = holding!.id as string;
        const { error: uErr } = await supabase.from("savings_auto_save")
          .update({ goal_id: goalId } as any).eq("id", alert.schedule_id);
        if (uErr) throw uErr;
      }

      // Force-run via edge function
      const { data, error } = await supabase.functions.invoke("process-auto-save", {
        body: { schedule_id: alert.schedule_id, force: true },
      });
      if (error) throw error;
      const entry = (data as any)?.perSchedule?.[0];
      const outcome = entry?.outcome ?? "done";
      const reason = entry?.reason ?? "";
      if (outcome === "collected" || outcome === "settled") {
        toast.success(`Re-run succeeded: ${outcome}${reason ? ` — ${reason}` : ""}`);
        markResolved(alert.id);
      } else {
        toast.error(`Re-run still failed: ${outcome}${reason ? ` — ${reason}` : ""}`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Re-run failed");
    } finally {
      setBusy(null);
    }
  };

  // No-deduction acknowledgement: no_goal does NOT debit the wallet, so no actual refund is required.
  // This action confirms the safety check and dismisses the alert.
  const acknowledgeNoRefund = async (alert: Alert) => {
    setBusy(alert.id);
    try {
      // Verify no transaction exists for this run log
      if (alert.transaction_id) {
        toast.error("This entry has a linked transaction — manual review required");
        return;
      }
      // Notify the user so they know admin reviewed
      await supabase.from("notifications").insert({
        user_id: alert.user_id,
        title: "DPS schedule reviewed",
        body: "We checked your DPS schedule — no funds were deducted. We'll notify you when the next installment runs successfully.",
        category: "savings",
      });
      toast.success("Confirmed — no funds were deducted");
      markResolved(alert.id);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to acknowledge");
    } finally {
      setBusy(null);
    }
  };

  const open = alerts.filter((a) => !a.resolved);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <BellRing className="w-5 h-5 text-amber-500" />
            DPS Alerts — No-goal & misroute events
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Real-time notifications when schedules run without a linked goal. No funds are deducted on these events.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll}>
          <RefreshCw size={14} className="mr-1" />Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{open.length}</p>
          <p className="text-xs text-muted-foreground">Open alerts</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{alerts.length - open.length}</p>
          <p className="text-xs text-muted-foreground">Resolved this session</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <BellRing className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{alerts.length}</p>
          <p className="text-xs text-muted-foreground">Total tracked</p>
        </CardContent></Card>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : alerts.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">No DPS alerts</p>
            <p className="text-xs text-muted-foreground">Every schedule run has linked to a goal.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => {
            const p = profiles[a.user_id];
            const isBusy = busy === a.id;
            return (
              <Card
                key={a.id}
                className={`border-0 shadow-sm ${a.resolved ? "opacity-60" : ""}`}
              >
                <CardContent className="p-3 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px]">
                        no_goal
                      </Badge>
                      {a.resolved && (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px]">
                          Resolved
                        </Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(a.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground mt-1">
                      {p?.name ?? "—"} <span className="text-xs text-muted-foreground">{p?.phone ?? ""}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.reason ?? "no_goal"} · schedule <span className="font-mono">{a.schedule_id.substring(0, 8)}…</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Amount on schedule: ৳{Number(a.amount || 0).toLocaleString()} · No funds were deducted
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => acknowledgeNoRefund(a)}
                      disabled={isBusy || a.resolved}
                      title="Acknowledge — no refund needed (no funds were deducted)"
                    >
                      <Undo2 size={14} className="mr-1" />Confirm safe
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => safeRerun(a)}
                      disabled={isBusy || a.resolved}
                      title="Auto-create holding goal (if needed) and re-run"
                    >
                      <Wand2 size={14} className={`mr-1 ${isBusy ? "animate-pulse" : ""}`} />
                      {isBusy ? "Working…" : "Safe re-run"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

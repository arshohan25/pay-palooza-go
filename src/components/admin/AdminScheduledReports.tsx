import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarClock, Download, Loader2, Play, Plus, Trash2 } from "lucide-react";

const REPORT_TYPES = [
  { key: "revenue_summary", label: "Revenue summary" },
  { key: "transactions", label: "Transactions" },
  { key: "new_users", label: "New users" },
  { key: "kyc_queue", label: "KYC queue" },
  { key: "settlements", label: "Settlements" },
];

const FREQUENCIES = ["daily", "weekly", "monthly"];

interface Report {
  id: string;
  report_key: string;
  label: string;
  frequency: string;
  recipients: string[];
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string;
}

interface Run {
  id: string;
  report_id: string;
  status: string;
  row_count: number;
  csv_content: string | null;
  error_message: string | null;
  created_at: string;
}

/** Admin scheduler for recurring CSV reports delivered by email. */
const AdminScheduledReports = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [form, setForm] = useState({ report_key: "revenue_summary", frequency: "weekly", recipients: "" });

  const load = async () => {
    const [reportsRes, runsRes] = await Promise.all([
      supabase.from("admin_scheduled_reports").select("*").order("created_at", { ascending: false }),
      supabase.from("admin_scheduled_report_runs").select("*").order("created_at", { ascending: false }).limit(40),
    ]);
    if (reportsRes.error) toast.error(reportsRes.error.message);
    setReports((reportsRes.data ?? []) as Report[]);
    setRuns((runsRes.data ?? []) as Run[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-scheduled-reports")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_scheduled_reports" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_scheduled_report_runs" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const create = async () => {
    const recipients = form.recipients.split(",").map(r => r.trim()).filter(Boolean);
    if (recipients.length === 0) { toast.error("Add at least one recipient email"); return; }
    const invalid = recipients.find(r => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r));
    if (invalid) { toast.error(`Invalid email: ${invalid}`); return; }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("admin_scheduled_reports").insert({
      report_key: form.report_key,
      label: REPORT_TYPES.find(r => r.key === form.report_key)?.label ?? form.report_key,
      frequency: form.frequency,
      recipients,
      created_by: session?.user?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Report scheduled");
    setForm({ report_key: "revenue_summary", frequency: "weekly", recipients: "" });
    load();
  };

  const toggleActive = async (report: Report) => {
    const { error } = await supabase
      .from("admin_scheduled_reports")
      .update({ is_active: !report.is_active })
      .eq("id", report.id);
    if (error) toast.error(error.message);
    else load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("admin_scheduled_reports").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Schedule removed"); load(); }
  };

  const runNow = async (report: Report) => {
    setRunning(report.id);
    const { data, error } = await supabase.functions.invoke("admin-scheduled-reports", {
      body: { report_id: report.id },
    });
    setRunning(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Generated ${data?.row_count ?? 0} rows${data?.emailed ? " and emailed" : " (download below)"}`);
    load();
  };

  const downloadRun = (run: Run) => {
    if (!run.csv_content) { toast.error("No CSV stored for this run"); return; }
    const blob = new Blob([run.csv_content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${run.created_at.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">New scheduled report</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Report</Label>
            <Select value={form.report_key} onValueChange={(v) => setForm({ ...form, report_key: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map(r => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Frequency</Label>
            <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map(f => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Recipients (comma separated)</Label>
            <Input
              value={form.recipients}
              onChange={(e) => setForm({ ...form, recipients: e.target.value })}
              placeholder="finance@example.com, ceo@example.com"
            />
          </div>
        </div>
        <Button onClick={create} disabled={saving} className="w-full md:w-auto">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          Schedule report
        </Button>
      </Card>

      <Card className="p-4 space-y-2">
        <h3 className="font-semibold text-foreground text-sm">Schedules</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : reports.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No schedules yet.</p>
        ) : (
          reports.map((r) => (
            <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{r.label || r.report_key}</span>
                  <Badge variant="secondary" className="text-[10px] capitalize">{r.frequency}</Badge>
                  {!r.is_active && <Badge variant="outline" className="text-[10px]">paused</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{r.recipients.join(", ")}</p>
                <p className="text-[10px] text-muted-foreground">
                  Last run: {r.last_run_at ? new Date(r.last_run_at).toLocaleString() : "never"} · Next: {new Date(r.next_run_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                <Button variant="outline" size="sm" className="h-7 text-[11px]" disabled={running === r.id} onClick={() => runNow(r)}>
                  {running === r.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                  Run now
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => remove(r.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>

      <Card className="p-4 space-y-2">
        <h3 className="font-semibold text-foreground text-sm">Recent runs</h3>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No runs yet.</p>
        ) : (
          runs.map((run) => (
            <div key={run.id} className="flex items-center gap-2 rounded-lg bg-muted/20 px-3 py-2 text-xs">
              <Badge
                variant="outline"
                className={`text-[10px] capitalize ${run.status === "sent" ? "border-emerald-500/40 text-emerald-500" : run.status === "failed" ? "border-destructive/40 text-destructive" : ""}`}
              >
                {run.status}
              </Badge>
              <span className="text-muted-foreground">{new Date(run.created_at).toLocaleString()}</span>
              <span className="text-muted-foreground">· {run.row_count} rows</span>
              {run.error_message && <span className="text-destructive truncate">{run.error_message}</span>}
              {run.csv_content && (
                <Button variant="ghost" size="sm" className="ml-auto h-6 text-[10px]" onClick={() => downloadRun(run)}>
                  <Download className="w-3 h-3 mr-1" /> CSV
                </Button>
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
};

export default AdminScheduledReports;

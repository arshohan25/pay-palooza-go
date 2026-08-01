import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Plus, Power, Trash2 } from "lucide-react";

interface Incident {
  id: string;
  title: string;
  message: string;
  severity: string;
  scope: string;
  read_only: boolean;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
}

const SEVERITIES = ["info", "warning", "critical"];
const SCOPES = ["all", "customer", "agent", "merchant", "distributor", "admin"];

const SEVERITY_STYLE: Record<string, string> = {
  info: "bg-primary/10 text-primary border-primary/30",
  warning: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  critical: "bg-destructive/10 text-destructive border-destructive/30",
};

/** Admin control for platform-wide incident / maintenance banners and read-only locks. */
const AdminIncidentMode = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    message: "",
    severity: "warning",
    scope: "all",
    read_only: false,
    ends_at: "",
  });

  const load = async () => {
    const { data, error } = await supabase
      .from("platform_incidents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) toast.error(error.message);
    setIncidents((data ?? []) as Incident[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-platform-incidents")
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_incidents" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const create = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("platform_incidents").insert({
      title: form.title.trim(),
      message: form.message.trim(),
      severity: form.severity,
      scope: form.scope,
      read_only: form.read_only,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      created_by: session?.user?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Incident published");
    setForm({ title: "", message: "", severity: "warning", scope: "all", read_only: false, ends_at: "" });
    load();
  };

  const toggleActive = async (incident: Incident) => {
    const { error } = await supabase
      .from("platform_incidents")
      .update({ is_active: !incident.is_active })
      .eq("id", incident.id);
    if (error) { toast.error(error.message); return; }
    toast.success(incident.is_active ? "Incident resolved" : "Incident re-activated");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("platform_incidents").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Incident deleted");
    load();
  };

  const activeCount = incidents.filter(i => i.is_active).length;

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h3 className="font-semibold text-foreground">Declare incident / maintenance</h3>
          {activeCount > 0 && (
            <Badge variant="outline" className="ml-auto text-[10px] border-destructive/40 text-destructive">
              {activeCount} live
            </Badge>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Scheduled maintenance"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ends at (optional)</Label>
            <Input
              type="datetime-local"
              value={form.ends_at}
              onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Severity</Label>
            <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEVERITIES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Audience</Label>
            <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCOPES.map(s => <SelectItem key={s} value={s} className="capitalize">{s === "all" ? "All apps" : s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Message</Label>
            <Textarea
              rows={3}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="We are performing maintenance. Transfers may be delayed."
            />
          </div>
          <div className="md:col-span-2 flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">Read-only lock</p>
              <p className="text-xs text-muted-foreground">Warn users that write actions are paused during this window.</p>
            </div>
            <Switch checked={form.read_only} onCheckedChange={(v) => setForm({ ...form, read_only: v })} />
          </div>
        </div>

        <Button onClick={create} disabled={saving} className="w-full md:w-auto">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          Publish incident
        </Button>
      </Card>

      <Card className="p-4 space-y-2">
        <h3 className="font-semibold text-foreground text-sm">Incident history</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : incidents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No incidents declared yet.</p>
        ) : (
          incidents.map((inc) => (
            <div key={inc.id} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-foreground truncate">{inc.title}</span>
                  <Badge variant="outline" className={`text-[10px] capitalize ${SEVERITY_STYLE[inc.severity] ?? ""}`}>{inc.severity}</Badge>
                  <Badge variant="secondary" className="text-[10px] capitalize">{inc.scope}</Badge>
                  {inc.read_only && <Badge variant="outline" className="text-[10px]">read-only</Badge>}
                  {inc.is_active ? (
                    <Badge className="text-[10px] bg-emerald-500/15 text-emerald-500 border-0">live</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">resolved</Badge>
                  )}
                </div>
                {inc.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{inc.message}</p>}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(inc.starts_at).toLocaleString()}
                  {inc.ends_at ? ` → ${new Date(inc.ends_at).toLocaleString()}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => toggleActive(inc)}>
                  <Power className="w-3 h-3 mr-1" />
                  {inc.is_active ? "Resolve" : "Re-open"}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => remove(inc.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
};

export default AdminIncidentMode;

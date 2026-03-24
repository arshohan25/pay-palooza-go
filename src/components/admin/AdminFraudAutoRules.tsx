import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, RefreshCw, Zap, ShieldAlert, Clock, Bot, Pencil } from "lucide-react";
import { toast } from "sonner";

const METRICS = [
  { value: "daily_txn_count", label: "Daily Transaction Count" },
  { value: "weekly_volume", label: "Weekly Volume (৳)" },
  { value: "daily_recipients", label: "Daily Unique Recipients" },
  { value: "failed_pin_attempts", label: "Failed PIN Attempts (24h)" },
  { value: "device_count", label: "Registered Devices" },
];

const ACTIONS = [
  { value: "lock_account", label: "Lock Account" },
  { value: "lock_send_money", label: "Lock Send Money" },
  { value: "flag_only", label: "Flag Only (Alert)" },
];

const DURATIONS = [
  { value: "permanent", label: "Permanent" },
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
];

interface AutoRule {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  action: string;
  lock_duration: string;
  is_active: boolean;
  created_at: string;
}

interface RuleLog {
  id: string;
  rule_id: string;
  user_id: string;
  metric_value: number;
  action_taken: string;
  created_at: string;
}

async function auditLog(action: string, entityType: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id, action, entity_type: entityType, entity_id: entityId, details
    });
  }
}

export default function AdminFraudAutoRules() {
  const [rules, setRules] = useState<AutoRule[]>([]);
  const [logs, setLogs] = useState<RuleLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AutoRule | null>(null);
  const [form, setForm] = useState({ name: "", metric: "daily_txn_count", threshold: "", action: "lock_account", lock_duration: "permanent" });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [rulesRes, logsRes] = await Promise.all([
      supabase.from("fraud_auto_rules").select("*").order("created_at", { ascending: false }),
      supabase.from("fraud_auto_rule_logs").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setRules((rulesRes.data ?? []) as AutoRule[]);
    setLogs((logsRes.data ?? []) as RuleLog[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const resetForm = () => setForm({ name: "", metric: "daily_txn_count", threshold: "", action: "lock_account", lock_duration: "permanent" });

  const createRule = async () => {
    if (!form.name || !form.threshold) { toast.error("Name and threshold required"); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.from("fraud_auto_rules").insert({
        name: form.name, metric: form.metric, threshold: Number(form.threshold),
        action: form.action, lock_duration: form.lock_duration, created_by: session?.user?.id,
      } as any).select().single();
      if (error) throw error;
      await auditLog("fraud_rule_create", "fraud_auto_rule", data.id, { name: form.name, metric: form.metric, threshold: Number(form.threshold) });
      toast.success("Rule created");
      setShowCreate(false);
      resetForm();
      loadData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const openEdit = (rule: AutoRule) => {
    setEditing(rule);
    setForm({ name: rule.name, metric: rule.metric, threshold: String(rule.threshold), action: rule.action, lock_duration: rule.lock_duration });
  };

  const saveEdit = async () => {
    if (!editing || !form.name || !form.threshold) { toast.error("Name and threshold required"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("fraud_auto_rules").update({
        name: form.name, metric: form.metric, threshold: Number(form.threshold),
        action: form.action, lock_duration: form.lock_duration, updated_at: new Date().toISOString(),
      } as any).eq("id", editing.id);
      if (error) throw error;
      await auditLog("fraud_rule_edit", "fraud_auto_rule", editing.id, { name: form.name, metric: form.metric, threshold: Number(form.threshold) });
      toast.success("Rule updated");
      setEditing(null);
      resetForm();
      loadData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const toggleRule = async (rule: AutoRule) => {
    const { error } = await supabase.from("fraud_auto_rules").update({ is_active: !rule.is_active } as any).eq("id", rule.id);
    if (error) { toast.error("Failed to toggle"); return; }
    await auditLog("fraud_rule_toggle", "fraud_auto_rule", rule.id, { name: rule.name, is_active: !rule.is_active });
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
    toast.success(rule.is_active ? "Rule disabled" : "Rule enabled");
  };

  const deleteRule = async (id: string) => {
    const rule = rules.find(r => r.id === id);
    const { error } = await supabase.from("fraud_auto_rules").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    await auditLog("fraud_rule_delete", "fraud_auto_rule", id, { name: rule?.name });
    setRules(prev => prev.filter(r => r.id !== id));
    toast.success("Rule deleted");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const dialogOpen = showCreate || !!editing;
  const dialogTitle = editing ? "Edit Auto-Rule" : "Create Auto-Rule";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Automated Fraud Rules</h3>
          <Badge variant="outline" className="text-[10px]">{rules.length} rules</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}><RefreshCw className="w-3.5 h-3.5" /></Button>
          <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }}><Plus className="w-3.5 h-3.5 mr-1" /> New Rule</Button>
        </div>
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="logs">Action Log ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-3">
          {rules.length === 0 ? (
            <Card className="border-0 shadow-sm"><CardContent className="py-12 text-center text-muted-foreground text-sm">No auto-rules configured. Create your first rule above.</CardContent></Card>
          ) : (
            rules.map(rule => (
              <Card key={rule.id} className={`border-0 shadow-sm ${!rule.is_active ? "opacity-60" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground text-sm">{rule.name}</span>
                        <Badge variant="secondary" className="text-[10px]">{METRICS.find(m => m.value === rule.metric)?.label || rule.metric}</Badge>
                        <Badge variant="outline" className="text-[10px]">{ACTIONS.find(a => a.value === rule.action)?.label || rule.action}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Threshold: <span className="font-medium text-foreground">{rule.threshold}</span> · Duration: {rule.lock_duration}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={rule.is_active} onCheckedChange={() => toggleRule(rule)} />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(rule)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
                            <AlertDialogDescription>Delete "{rule.name}"? This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteRule(rule.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="logs">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <ScrollArea className="max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Rule</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Metric Value</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map(log => {
                      const rule = rules.find(r => r.id === log.rule_id);
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </TableCell>
                          <TableCell className="text-sm font-medium text-foreground">{rule?.name || log.rule_id.slice(0, 8)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">{log.user_id.slice(0, 12)}…</TableCell>
                          <TableCell className="text-sm font-bold text-foreground">{log.metric_value}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-[10px] capitalize">{log.action_taken.replace(/_/g, " ")}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                    {logs.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-8">No auto-triggered actions yet</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Rule Dialog */}
      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) { setShowCreate(false); setEditing(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> {dialogTitle}</DialogTitle>
            <DialogDescription>{editing ? "Update the rule configuration." : "Define a trigger that automatically takes action when thresholds are breached."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Rule Name</Label>
              <Input placeholder="e.g. High velocity lock" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Metric</Label>
              <Select value={form.metric} onValueChange={v => setForm(f => ({ ...f, metric: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{METRICS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Threshold</Label>
              <Input type="number" placeholder="e.g. 50" value={form.threshold} onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Action</Label>
              <Select value={form.action} onValueChange={v => setForm(f => ({ ...f, action: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Lock Duration</Label>
              <Select value={form.lock_duration} onValueChange={v => setForm(f => ({ ...f, lock_duration: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DURATIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowCreate(false); setEditing(null); resetForm(); }}>Cancel</Button>
            <Button onClick={editing ? saveEdit : createRule} disabled={saving}>{saving ? "Saving…" : editing ? "Update Rule" : "Create Rule"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

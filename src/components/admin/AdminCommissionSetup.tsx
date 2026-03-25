import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Coins, Pencil, Plus, Calculator, ScrollText, Layers, Building2, Users, UserCheck, Landmark, Trash2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRealtimeIndicator } from "@/hooks/use-realtime-indicator";
import RealtimeUpdateIndicator from "@/components/admin/RealtimeUpdateIndicator";

interface CommissionRow {
  id: string;
  txn_type: string;
  agent_commission: number | null;
  distributor_commission: number | null;
  master_distributor_commission: number | null;
  platform_share: number | null;
  fee_value: number;
  fee_type: string;
  is_active: boolean;
}

interface CommissionTier {
  id: string;
  fee_config_id: string;
  min_amount: number;
  max_amount: number | null;
  agent_rate: number;
  distributor_rate: number;
  master_distributor_rate: number;
  company_rate: number;
  is_active: boolean;
}

interface CommissionLog {
  id: string;
  txn_type: string;
  txn_amount: number;
  total_fee: number;
  agent_amount: number;
  distributor_amount: number;
  master_distributor_amount: number;
  company_amount: number;
  created_at: string;
}

const TXN_TYPES = ["send", "cashout", "cashin", "payment", "recharge", "paybill", "addmoney", "banktransfer"];

export default function AdminCommissionSetup() {
  const { visible: realtimeVisible, flash: realtimeFlash } = useRealtimeIndicator();

  return (
    <div className="space-y-4">
      <RealtimeUpdateIndicator visible={realtimeVisible} />
      <div>
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Coins className="w-5 h-5 text-primary" /> Commission & Charge Engine
        </h3>
        <p className="text-sm text-muted-foreground">Hierarchical commission management: Agent → Distributor → Master Distributor → Company</p>
      </div>

      <Tabs defaultValue="rules" className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-auto">
          <TabsTrigger value="rules" className="text-xs gap-1"><Layers className="w-3.5 h-3.5 hidden sm:inline" /> Rules</TabsTrigger>
          <TabsTrigger value="tiers" className="text-xs gap-1"><Coins className="w-3.5 h-3.5 hidden sm:inline" /> Tiers</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs gap-1"><ScrollText className="w-3.5 h-3.5 hidden sm:inline" /> Logs</TabsTrigger>
          <TabsTrigger value="calculator" className="text-xs gap-1"><Calculator className="w-3.5 h-3.5 hidden sm:inline" /> Calc</TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <RulesTab realtimeFlash={realtimeFlash} />
        </TabsContent>
        <TabsContent value="tiers">
          <TiersTab realtimeFlash={realtimeFlash} />
        </TabsContent>
        <TabsContent value="logs">
          <LogsTab />
        </TabsContent>
        <TabsContent value="calculator">
          <CalculatorTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Tab 1: Commission Rules ─── */
function RulesTab({ realtimeFlash }: { realtimeFlash: () => void }) {
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CommissionRow | null>(null);
  const [form, setForm] = useState({ agent: "", distributor: "", md: "", platform: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fee_config")
      .select("id, txn_type, agent_commission, distributor_commission, master_distributor_commission, platform_share, fee_value, fee_type, is_active")
      .order("txn_type");
    setRows((data as CommissionRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel("comm-rules-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "fee_config" }, () => { load(); realtimeFlash(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, realtimeFlash]);

  const openEdit = (r: CommissionRow) => {
    setEditing(r);
    setForm({
      agent: r.agent_commission != null ? String(r.agent_commission) : "",
      distributor: r.distributor_commission != null ? String(r.distributor_commission) : "",
      md: r.master_distributor_commission != null ? String(r.master_distributor_commission) : "",
      platform: r.platform_share != null ? String(r.platform_share) : "",
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    const { error } = await supabase.from("fee_config").update({
      agent_commission: form.agent ? parseFloat(form.agent) : 0,
      distributor_commission: form.distributor ? parseFloat(form.distributor) : 0,
      master_distributor_commission: form.md ? parseFloat(form.md) : 0,
      platform_share: form.platform ? parseFloat(form.platform) : 0,
    }).eq("id", editing.id);
    if (error) { toast.error("Failed to update"); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await supabase.from("audit_logs").insert({ actor_id: session.user.id, action: "commission_rule_edit", entity_type: "fee_config", entity_id: editing.id, details: { txn_type: editing.txn_type, agent: form.agent, distributor: form.distributor } });
    toast.success("Commission updated");
    setEditing(null);
    load();
  };

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Agent", icon: Users, color: "text-emerald-600", key: "agent_commission" as const },
          { label: "Distributor", icon: UserCheck, color: "text-blue-600", key: "distributor_commission" as const },
          { label: "Master Dist.", icon: Building2, color: "text-amber-600", key: "master_distributor_commission" as const },
          { label: "Company", icon: Landmark, color: "text-purple-600", key: "platform_share" as const },
        ].map(s => {
          const avg = rows.length ? (rows.reduce((a, r) => a + ((r[s.key] as number) ?? 0), 0) / rows.length).toFixed(2) : "—";
          return (
            <Card key={s.label} className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-3 text-center">
                <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
                <p className={`text-sm font-bold ${s.color}`}>{avg === "—" ? avg : avg + "%"}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-3 py-2.5 font-medium text-xs">Type</th>
                  <th className="text-left px-3 py-2.5 font-medium text-xs">Agent</th>
                  <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Dist.</th>
                  <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">M.Dist.</th>
                  <th className="text-left px-3 py-2.5 font-medium text-xs hidden md:table-cell">Company</th>
                  <th className="text-left px-3 py-2.5 font-medium text-xs">Edit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const companyCalc = (r.fee_value && r.fee_type === "percentage")
                    ? Math.max(0, r.fee_value - (r.agent_commission ?? 0) - (r.distributor_commission ?? 0) - (r.master_distributor_commission ?? 0)).toFixed(2)
                    : (r.platform_share ?? 0).toFixed(2);
                  return (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5"><Badge variant="secondary" className="text-[10px] capitalize">{r.txn_type}</Badge></td>
                      <td className="px-3 py-2.5 font-semibold text-emerald-600 text-xs">{r.agent_commission ?? 0}%</td>
                      <td className="px-3 py-2.5 font-semibold text-blue-600 text-xs hidden sm:table-cell">{r.distributor_commission ?? 0}%</td>
                      <td className="px-3 py-2.5 font-semibold text-amber-600 text-xs hidden sm:table-cell">{r.master_distributor_commission ?? 0}%</td>
                      <td className="px-3 py-2.5 font-semibold text-purple-600 text-xs hidden md:table-cell">{companyCalc}%</td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={async () => {
                            if (!confirm("Delete this commission rule?")) return;
                            const { error } = await supabase.from("fee_config").delete().eq("id", r.id);
                            if (error) { toast.error("Failed to delete"); return; }
                            const { data: { session } } = await supabase.auth.getSession();
                            if (session?.user) await supabase.from("audit_logs").insert({ actor_id: session.user.id, action: "commission_rule_delete", entity_type: "fee_config", entity_id: r.id, details: { txn_type: r.txn_type } });
                            toast.success("Commission rule deleted");
                            load();
                          }}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && rows.length === 0 && (
            <EmptyState icon={Coins} title="No commission rules" subtitle="Add fee rules first in Charge Config" />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Commission — <span className="capitalize">{editing?.txn_type}</span></DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>Agent Commission (%)</Label><Input type="number" step="0.01" value={form.agent} onChange={e => setForm(f => ({ ...f, agent: e.target.value }))} /></div>
            <div><Label>Distributor Commission (%)</Label><Input type="number" step="0.01" value={form.distributor} onChange={e => setForm(f => ({ ...f, distributor: e.target.value }))} /></div>
            <div><Label>Master Distributor Commission (%)</Label><Input type="number" step="0.01" value={form.md} onChange={e => setForm(f => ({ ...f, md: e.target.value }))} /></div>
            <div><Label>Platform Share (%)</Label><Input type="number" step="0.01" value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} /></div>
            <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
              Company Profit = Total Fee − Agent − Distributor − Master Distributor (auto-calculated)
            </div>
            <Button className="w-full" onClick={handleSave}>Update Commission</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Tab 2: Commission Tiers ─── */
function TiersTab({ realtimeFlash }: { realtimeFlash: () => void }) {
  const [tiers, setTiers] = useState<CommissionTier[]>([]);
  const [feeConfigs, setFeeConfigs] = useState<{ id: string; txn_type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CommissionTier | null>(null);
  const [form, setForm] = useState({
    fee_config_id: "", min_amount: "0", max_amount: "", agent_rate: "4.90",
    distributor_rate: "2.00", master_distributor_rate: "1.50", is_active: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: t }, { data: fc }] = await Promise.all([
      supabase.from("commission_tiers").select("*").order("min_amount"),
      supabase.from("fee_config").select("id, txn_type").eq("is_active", true).order("txn_type"),
    ]);
    setTiers((t as CommissionTier[]) ?? []);
    setFeeConfigs(fc ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel("comm-tiers-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "commission_tiers" }, () => { load(); realtimeFlash(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, realtimeFlash]);

  const openAdd = () => {
    setEditing(null);
    setForm({ fee_config_id: feeConfigs[0]?.id ?? "", min_amount: "0", max_amount: "", agent_rate: "4.90", distributor_rate: "2.00", master_distributor_rate: "1.50", is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (t: CommissionTier) => {
    setEditing(t);
    setForm({
      fee_config_id: t.fee_config_id, min_amount: String(t.min_amount),
      max_amount: t.max_amount != null ? String(t.max_amount) : "",
      agent_rate: String(t.agent_rate), distributor_rate: String(t.distributor_rate),
      master_distributor_rate: String(t.master_distributor_rate), is_active: t.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      fee_config_id: form.fee_config_id,
      min_amount: parseFloat(form.min_amount) || 0,
      max_amount: form.max_amount ? parseFloat(form.max_amount) : null,
      agent_rate: parseFloat(form.agent_rate) || 0,
      distributor_rate: parseFloat(form.distributor_rate) || 0,
      master_distributor_rate: parseFloat(form.master_distributor_rate) || 0,
      is_active: form.is_active,
    };
    if (editing) {
      const { error } = await supabase.from("commission_tiers").update(payload).eq("id", editing.id);
      if (error) { toast.error("Failed to update tier"); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) await supabase.from("audit_logs").insert({ actor_id: session.user.id, action: "commission_tier_edit", entity_type: "commission_tier", entity_id: editing.id, details: payload });
      toast.success("Tier updated");
    } else {
      const { data, error } = await supabase.from("commission_tiers").insert(payload).select().single();
      if (error) { toast.error("Failed to create tier"); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) await supabase.from("audit_logs").insert({ actor_id: session.user.id, action: "commission_tier_create", entity_type: "commission_tier", entity_id: data.id, details: payload });
      toast.success("Tier created");
    }
    setDialogOpen(false);
    load();
  };

  const companyPreview = Math.max(0, 11.90 - (parseFloat(form.agent_rate) || 0) - (parseFloat(form.distributor_rate) || 0) - (parseFloat(form.master_distributor_rate) || 0)).toFixed(2);
  const fcMap = Object.fromEntries(feeConfigs.map(f => [f.id, f.txn_type]));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Per-৳1,000 commission breakdown tiers</p>
        <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> Add Tier</Button>
      </div>

      {/* Per-1000 breakdown preview */}
      <Card className="border-0 shadow-[var(--shadow-card)] bg-muted/30">
        <CardContent className="p-3">
          <p className="text-xs font-medium text-foreground mb-2">Default Per ৳1,000 Breakdown (1.19% = ৳11.90)</p>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div><p className="text-muted-foreground">Agent</p><p className="font-bold text-emerald-600">৳4.90</p></div>
            <div><p className="text-muted-foreground">Distributor</p><p className="font-bold text-blue-600">৳2.00</p></div>
            <div><p className="text-muted-foreground">M.Dist.</p><p className="font-bold text-amber-600">৳1.50</p></div>
            <div><p className="text-muted-foreground">Company</p><p className="font-bold text-purple-600">৳3.40</p></div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-3 py-2.5 font-medium text-xs">Type</th>
                  <th className="text-left px-3 py-2.5 font-medium text-xs">Range</th>
                  <th className="text-left px-3 py-2.5 font-medium text-xs">Agent</th>
                  <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Dist.</th>
                  <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">M.D.</th>
                  <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Co.</th>
                  <th className="text-left px-3 py-2.5 font-medium text-xs">Edit</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map(t => (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5"><Badge variant="secondary" className="text-[10px] capitalize">{fcMap[t.fee_config_id] || "—"}</Badge></td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">৳{t.min_amount}–{t.max_amount ? `৳${t.max_amount}` : "∞"}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-emerald-600">৳{t.agent_rate}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-blue-600 hidden sm:table-cell">৳{t.distributor_rate}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-amber-600 hidden sm:table-cell">৳{t.master_distributor_rate}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-purple-600 hidden sm:table-cell">৳{t.company_rate}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={async () => {
                          if (!confirm("Delete this commission tier?")) return;
                          const { error } = await supabase.from("commission_tiers").delete().eq("id", t.id);
                          if (error) { toast.error("Failed to delete"); return; }
                          const { data: { session } } = await supabase.auth.getSession();
                          if (session?.user) await supabase.from("audit_logs").insert({ actor_id: session.user.id, action: "commission_tier_delete", entity_type: "commission_tier", entity_id: t.id, details: { min_amount: t.min_amount, max_amount: t.max_amount } });
                          toast.success("Commission tier deleted");
                          load();
                        }}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && tiers.length === 0 && (
            <EmptyState icon={Layers} title="No tiers configured" subtitle="Add a tier to define per-৳1,000 splits" />
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Tier" : "Add Commission Tier"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label>Fee Rule (Txn Type)</Label>
              <Select value={form.fee_config_id} onValueChange={v => setForm(f => ({ ...f, fee_config_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {feeConfigs.map(fc => <SelectItem key={fc.id} value={fc.id}>{fc.txn_type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Min Amount (৳)</Label><Input type="number" value={form.min_amount} onChange={e => setForm(f => ({ ...f, min_amount: e.target.value }))} /></div>
              <div><Label>Max Amount (৳)</Label><Input type="number" placeholder="No max" value={form.max_amount} onChange={e => setForm(f => ({ ...f, max_amount: e.target.value }))} /></div>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Rates per ৳1,000 transaction:</p>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">Agent (৳)</Label><Input type="number" step="0.01" value={form.agent_rate} onChange={e => setForm(f => ({ ...f, agent_rate: e.target.value }))} /></div>
              <div><Label className="text-xs">Dist. (৳)</Label><Input type="number" step="0.01" value={form.distributor_rate} onChange={e => setForm(f => ({ ...f, distributor_rate: e.target.value }))} /></div>
              <div><Label className="text-xs">M.Dist. (৳)</Label><Input type="number" step="0.01" value={form.master_distributor_rate} onChange={e => setForm(f => ({ ...f, master_distributor_rate: e.target.value }))} /></div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg text-xs flex items-center justify-between">
              <span className="text-muted-foreground">Company gets (per ৳1,000):</span>
              <span className="font-bold text-purple-600">৳{companyPreview}</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>Active</Label>
            </div>
            <Button className="w-full" onClick={handleSave}>{editing ? "Update" : "Create"} Tier</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Tab 3: Commission Logs ─── */
function LogsTab() {
  const [logs, setLogs] = useState<CommissionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("commission_logs").select("*").order("created_at", { ascending: false }).limit(100);
    if (typeFilter !== "all") q = q.eq("txn_type", typeFilter);
    const { data } = await q;
    setLogs((data as CommissionLog[]) ?? []);
    setLoading(false);
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel("comm-logs-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "commission_logs" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const exportCSV = () => {
    if (!logs.length) return;
    const headers = "Date,Type,Amount,Fee,Agent,Distributor,M.Distributor,Company\n";
    const csv = logs.map(l => `${new Date(l.created_at).toLocaleDateString()},${l.txn_type},${l.txn_amount},${l.total_fee},${l.agent_amount},${l.distributor_amount},${l.master_distributor_amount},${l.company_amount}`).join("\n");
    const blob = new Blob([headers + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "commission_logs.csv"; a.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 h-7 text-xs"><SelectValue placeholder="Filter type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TXN_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={exportCSV}><Download className="w-3.5 h-3.5" /></Button>
      </div>

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-3 py-2.5 font-medium text-xs">Date</th>
                  <th className="text-left px-3 py-2.5 font-medium text-xs">Type</th>
                  <th className="text-right px-3 py-2.5 font-medium text-xs">Amount</th>
                  <th className="text-right px-3 py-2.5 font-medium text-xs">Fee</th>
                  <th className="text-right px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Agent</th>
                  <th className="text-right px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Dist.</th>
                  <th className="text-right px-3 py-2.5 font-medium text-xs hidden md:table-cell">M.D.</th>
                  <th className="text-right px-3 py-2.5 font-medium text-xs hidden md:table-cell">Co.</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors text-xs">
                    <td className="px-3 py-2.5 text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2.5"><Badge variant="secondary" className="text-[10px] capitalize">{l.txn_type}</Badge></td>
                    <td className="px-3 py-2.5 text-right font-medium">৳{l.txn_amount.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right">৳{l.total_fee.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-600 hidden sm:table-cell">৳{l.agent_amount}</td>
                    <td className="px-3 py-2.5 text-right text-blue-600 hidden sm:table-cell">৳{l.distributor_amount}</td>
                    <td className="px-3 py-2.5 text-right text-amber-600 hidden md:table-cell">৳{l.master_distributor_amount}</td>
                    <td className="px-3 py-2.5 text-right text-purple-600 hidden md:table-cell">৳{l.company_amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && logs.length === 0 && (
            <EmptyState icon={ScrollText} title="No commission logs" subtitle="Logs will appear after transactions with commissions" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Tab 4: Calculator ─── */
function CalculatorTab() {
  const [txnType, setTxnType] = useState("cashout");
  const [amount, setAmount] = useState("1000");
  const [result, setResult] = useState<{ total_fee: number; agent: number; distributor: number; master_distributor: number; company: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const calculate = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("calculate_commission", { p_txn_type: txnType, p_amount: amt });
    setLoading(false);
    if (error) { toast.error("Calculation failed"); return; }
    setResult(data as any);
  };

  useEffect(() => { if (amount && parseFloat(amount) > 0) calculate(); }, [txnType, amount]);

  const total = result?.total_fee ?? 0;
  const slices = result ? [
    { label: "Agent", value: result.agent, color: "bg-emerald-500" },
    { label: "Distributor", value: result.distributor, color: "bg-blue-500" },
    { label: "M. Distributor", value: result.master_distributor, color: "bg-amber-500" },
    { label: "Company", value: result.company, color: "bg-purple-500" },
  ] : [];

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4 space-y-4">
          <p className="text-sm font-medium text-foreground">Commission Simulator</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Transaction Type</Label>
              <Select value={txnType} onValueChange={setTxnType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TXN_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (৳)</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Total Fee</span>
                  <span className="font-bold text-foreground">৳{total.toFixed(2)}</span>
                </div>
                {/* Bar chart */}
                {total > 0 && (
                  <div className="flex h-4 rounded-full overflow-hidden">
                    {slices.map(s => s.value > 0 && (
                      <div key={s.label} className={`${s.color} transition-all`} style={{ width: `${(s.value / total) * 100}%` }} />
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {slices.map(s => (
                  <div key={s.label} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                    <div className={`w-3 h-3 rounded-full ${s.color}`} />
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      <p className="text-sm font-bold text-foreground">৳{s.value.toFixed(2)}</p>
                    </div>
                    {total > 0 && <p className="text-[10px] text-muted-foreground">{((s.value / total) * 100).toFixed(1)}%</p>}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Shared Empty State ─── */
function EmptyState({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col items-center justify-center py-8 text-center">
      <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </motion.div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </motion.div>
  );
}

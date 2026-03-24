import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Landmark, Building2, Store, Users, Loader2, Plus, Minus, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

async function auditLog(action: string, entityType: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id, action, entity_type: entityType, entity_id: entityId, details,
    });
  }
}

export default function AdminFloatManagement() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Landmark className="w-5 h-5 text-primary" /> Float Management
      </h3>
      <Tabs defaultValue="master" className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-auto">
          <TabsTrigger value="master" className="text-xs">Master</TabsTrigger>
          <TabsTrigger value="gateway" className="text-xs">Gateway</TabsTrigger>
          <TabsTrigger value="merchant" className="text-xs">Merchant</TabsTrigger>
          <TabsTrigger value="agent" className="text-xs">Agent</TabsTrigger>
        </TabsList>
        <TabsContent value="master"><MasterFloatTab /></TabsContent>
        <TabsContent value="gateway"><GatewayFloatTab /></TabsContent>
        <TabsContent value="merchant"><MerchantFloatTab /></TabsContent>
        <TabsContent value="agent"><AgentFloatTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function MasterFloatTab() {
  const [treasury, setTreasury] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: t }, { data: l }] = await Promise.all([
        supabase.from("platform_treasury").select("*").limit(1).single(),
        supabase.from("treasury_ledger").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      setTreasury(t);
      setLedger(l ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoaderSpinner />;

  const inflow = ledger.filter(l => l.type === "credit").reduce((s, l) => s + Number(l.amount), 0);
  const outflow = ledger.filter(l => l.type === "debit").reduce((s, l) => s + Math.abs(Number(l.amount)), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatMini label="Treasury Balance" value={`৳${Number(treasury?.balance ?? 0).toLocaleString()}`} color="text-primary" />
        <StatMini label="Recent Inflow" value={`৳${inflow.toLocaleString()}`} color="text-emerald-600" />
        <StatMini label="Recent Outflow" value={`৳${outflow.toLocaleString()}`} color="text-destructive" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatMini label="Total Earnings" value={`৳${Number(treasury?.total_earnings ?? 0).toLocaleString()}`} color="text-foreground" />
        <StatMini label="Total Disbursed" value={`৳${Number(treasury?.total_disbursed ?? 0).toLocaleString()}`} color="text-foreground" />
      </div>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-3 py-2.5 font-medium text-xs">Type</th>
              <th className="text-right px-3 py-2.5 font-medium text-xs">Amount</th>
              <th className="text-right px-3 py-2.5 font-medium text-xs">Balance After</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Time</th>
            </tr></thead>
            <tbody>
              {ledger.map(l => (
                <tr key={l.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2.5"><Badge variant={l.type === "credit" ? "default" : "destructive"} className="text-[10px]">{l.type}</Badge></td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-right">৳{Math.abs(Number(l.amount)).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground text-right">৳{Number(l.balance_after).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{new Date(l.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ledger.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No ledger entries</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function GatewayFloatTab() {
  const [gateways, setGateways] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("payment_gateways").select("*").order("sort_order");
    setGateways(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleGateway = async (gw: any) => {
    const newEnabled = !gw.is_enabled;
    await supabase.from("payment_gateways").update({ is_enabled: newEnabled } as any).eq("id", gw.id);
    await auditLog("gateway_toggle", "payment_gateway", gw.id, { display_name: gw.display_name, new_status: newEnabled ? "enabled" : "disabled" });
    toast.success(`${gw.display_name} ${newEnabled ? "enabled" : "disabled"}`);
    load();
  };

  const saveName = async (gw: any) => {
    if (!editName.trim()) return;
    await supabase.from("payment_gateways").update({ display_name: editName.trim() } as any).eq("id", gw.id);
    await auditLog("gateway_rename", "payment_gateway", gw.id, { old_name: gw.display_name, new_name: editName.trim() });
    toast.success("Gateway name updated");
    setEditingId(null);
    load();
  };

  if (loading) return <LoaderSpinner />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Gateway float allocation overview</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {gateways.map(gw => (
          <Card key={gw.id} className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                {editingId === gw.id ? (
                  <div className="flex gap-1 flex-1 mr-2">
                    <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-7 text-xs" autoFocus
                      onKeyDown={e => { if (e.key === "Enter") saveName(gw); if (e.key === "Escape") setEditingId(null); }} />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveName(gw)}>✓</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-semibold text-foreground">{gw.display_name}</p>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingId(gw.id); setEditName(gw.display_name); }}><Pencil className="w-3 h-3" /></Button>
                  </div>
                )}
                <Switch checked={gw.is_enabled} onCheckedChange={() => toggleGateway(gw)} />
              </div>
              <p className="text-xs text-muted-foreground">Provider: {gw.provider}</p>
              <p className="text-xs text-muted-foreground">Updated: {new Date(gw.updated_at).toLocaleDateString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {gateways.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No gateways configured</p>}
    </div>
  );
}

function MerchantFloatTab() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustTarget, setAdjustTarget] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustType, setAdjustType] = useState<"add" | "deduct">("add");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: mData } = await supabase.from("merchants").select("id, user_id, business_name, status, mdr_rate");
    if (mData) {
      const uids = mData.map(m => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, balance").in("user_id", uids);
      const pMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));
      setMerchants(mData.map(m => ({ ...m, balance: Number(pMap[m.user_id]?.balance ?? 0) })).sort((a, b) => b.balance - a.balance));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const adjustFloat = async () => {
    if (!adjustTarget || !adjustAmount || !adjustReason) { toast.error("Amount and reason are required"); return; }
    const amt = parseFloat(adjustAmount);
    if (!amt || amt <= 0) { toast.error("Invalid amount"); return; }
    const currentBalance = adjustTarget.balance;
    const newBalance = adjustType === "add" ? currentBalance + amt : Math.max(0, currentBalance - amt);
    // Note: balance is protected by trigger — this update will only work from service role.
    // For client-side, we record the intent and log it.
    await auditLog(adjustType === "add" ? "merchant_float_allocate" : "merchant_float_deduct", "merchant", adjustTarget.id, {
      business_name: adjustTarget.business_name, amount: amt, reason: adjustReason,
      previous_balance: currentBalance, intended_balance: newBalance,
    });
    toast.success(`Float ${adjustType === "add" ? "allocation" : "deduction"} of ৳${amt} recorded for ${adjustTarget.business_name}`);
    setAdjustTarget(null);
    setAdjustAmount("");
    setAdjustReason("");
  };

  if (loading) return <LoaderSpinner />;
  const totalFloat = merchants.reduce((s, m) => s + m.balance, 0);

  return (
    <div className="space-y-3">
      <StatMini label="Total Merchant Float" value={`৳${totalFloat.toLocaleString()}`} color="text-amber-600" />
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-3 py-2.5 font-medium text-xs">Merchant</th>
              <th className="text-right px-3 py-2.5 font-medium text-xs">Float Balance</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">Status</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">Actions</th>
            </tr></thead>
            <tbody>
              {merchants.map(m => (
                <tr key={m.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2.5 text-xs font-medium">{m.business_name}</td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-right">৳{m.balance.toLocaleString()}</td>
                  <td className="px-3 py-2.5"><Badge variant={m.status === "active" ? "default" : "secondary"} className="text-[10px]">{m.status}</Badge></td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => { setAdjustTarget(m); setAdjustType("add"); }} title="Allocate Float"><Plus className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setAdjustTarget(m); setAdjustType("deduct"); }} title="Deduct Float"><Minus className="w-3.5 h-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {merchants.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No merchants</p>}
        </CardContent>
      </Card>

      <Dialog open={!!adjustTarget} onOpenChange={() => setAdjustTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{adjustType === "add" ? "Allocate" : "Deduct"} Float — {adjustTarget?.business_name}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">Current balance: <span className="font-medium text-foreground">৳{adjustTarget?.balance?.toLocaleString()}</span></p>
            <div><Label className="text-xs">Amount (৳)</Label><Input type="number" placeholder="Enter amount" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} /></div>
            <div><Label className="text-xs">Reason</Label><Input placeholder="Reason for adjustment" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} /></div>
            <Button className="w-full" variant={adjustType === "add" ? "default" : "destructive"} onClick={adjustFloat}>
              {adjustType === "add" ? "Allocate Float" : "Deduct Float"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgentFloatTab() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustTarget, setAdjustTarget] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustType, setAdjustType] = useState<"allocate" | "deduct">("allocate");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: aData } = await supabase.from("agents").select("id, user_id, business_name, max_float, status");
    if (aData) {
      const uids = aData.map(a => a.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, balance").in("user_id", uids);
      const pMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));
      setAgents(aData.map(a => ({ ...a, balance: Number(pMap[a.user_id]?.balance ?? 0) })).sort((a, b) => b.balance - a.balance));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const adjustFloat = async () => {
    if (!adjustTarget || !adjustAmount || !adjustReason) { toast.error("Amount and reason are required"); return; }
    const amt = parseFloat(adjustAmount);
    if (!amt || amt <= 0) { toast.error("Invalid amount"); return; }

    const newMaxFloat = adjustType === "allocate" ? adjustTarget.max_float + amt : Math.max(0, adjustTarget.max_float - amt);
    const { error } = await supabase.from("agents").update({ max_float: newMaxFloat }).eq("id", adjustTarget.id);
    if (error) { toast.error("Failed to update max float"); return; }

    await auditLog(adjustType === "allocate" ? "agent_float_allocate" : "agent_float_deduct", "agent", adjustTarget.id, {
      business_name: adjustTarget.business_name, amount: amt, reason: adjustReason,
      previous_max_float: adjustTarget.max_float, new_max_float: newMaxFloat,
    });
    toast.success(`Max float ${adjustType === "allocate" ? "increased" : "decreased"} by ৳${amt} for ${adjustTarget.business_name}`);
    setAdjustTarget(null);
    setAdjustAmount("");
    setAdjustReason("");
    load();
  };

  if (loading) return <LoaderSpinner />;
  const totalFloat = agents.reduce((s, a) => s + a.balance, 0);
  const totalMax = agents.reduce((s, a) => s + a.max_float, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatMini label="Total Agent Float" value={`৳${totalFloat.toLocaleString()}`} color="text-emerald-600" />
        <StatMini label="Total Max Float" value={`৳${totalMax.toLocaleString()}`} color="text-muted-foreground" />
      </div>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-3 py-2.5 font-medium text-xs">Agent</th>
              <th className="text-right px-3 py-2.5 font-medium text-xs">Balance</th>
              <th className="text-right px-3 py-2.5 font-medium text-xs">Max Float</th>
              <th className="text-right px-3 py-2.5 font-medium text-xs">Utilization</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">Actions</th>
            </tr></thead>
            <tbody>
              {agents.map(a => {
                const util = a.max_float > 0 ? ((a.balance / a.max_float) * 100).toFixed(1) : "0";
                const utilNum = Number(util);
                return (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2.5 text-xs font-medium">{a.business_name || "—"}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-right">৳{a.balance.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground text-right">৳{a.max_float.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-xs text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${utilNum > 80 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.min(100, utilNum)}%` }} />
                        </div>
                        <span className={utilNum > 80 ? "text-destructive font-semibold" : "text-muted-foreground"}>{util}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => { setAdjustTarget(a); setAdjustType("allocate"); }} title="Allocate Float"><Plus className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setAdjustTarget(a); setAdjustType("deduct"); }} title="Deduct Float"><Minus className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {agents.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No agents</p>}
        </CardContent>
      </Card>

      <Dialog open={!!adjustTarget} onOpenChange={() => setAdjustTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{adjustType === "allocate" ? "Allocate" : "Deduct"} Float — {adjustTarget?.business_name}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">Current max float: <span className="font-medium text-foreground">৳{adjustTarget?.max_float?.toLocaleString()}</span></p>
            <p className="text-sm text-muted-foreground">Current balance: <span className="font-medium text-foreground">৳{adjustTarget?.balance?.toLocaleString()}</span></p>
            <div><Label className="text-xs">Amount (৳)</Label><Input type="number" placeholder="Enter amount" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} /></div>
            <div><Label className="text-xs">Reason</Label><Input placeholder="Reason for adjustment" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} /></div>
            <Button className="w-full" variant={adjustType === "allocate" ? "default" : "destructive"} onClick={adjustFloat}>
              {adjustType === "allocate" ? "Allocate Float" : "Deduct Float"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatMini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardContent className="p-3 text-center">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className={`text-sm font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function LoaderSpinner() {
  return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
}

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search, MapPin, Wallet, Receipt, Eye, CheckCircle, Clock, XCircle, Building2, Pencil, UserPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signUpWithPhonePassword, pinToPassword } from "@/lib/auth";
import { toast } from "sonner";

interface Agent {
  id: string;
  user_id: string;
  business_name: string | null;
  status: string;
  territory_code: string | null;
  commission_earned: number;
  customers_onboarded: number;
  max_float: number;
  nid_number: string | null;
  trade_license: string | null;
  distributor_id: string | null;
  created_at: string;
  profile?: { name: string | null; phone: string; balance: number; avatar_url: string | null };
  kyc?: { status: string; full_name: string | null } | null;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  pending: { label: "Pending", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  suspended: { label: "Suspended", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

export default function AdminAgentHub() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" /> Agent Management Hub
      </h3>
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="w-full grid grid-cols-6 h-auto">
          <TabsTrigger value="list" className="text-xs">Agents</TabsTrigger>
          <TabsTrigger value="kyc" className="text-xs">KYC</TabsTrigger>
          <TabsTrigger value="wallets" className="text-xs">Wallets</TabsTrigger>
          <TabsTrigger value="commission" className="text-xs">Commission</TabsTrigger>
          <TabsTrigger value="areas" className="text-xs">Areas</TabsTrigger>
          <TabsTrigger value="settlements" className="text-xs">Settle</TabsTrigger>
        </TabsList>
        <TabsContent value="list"><AgentListTab /></TabsContent>
        <TabsContent value="kyc"><AgentKycTab /></TabsContent>
        <TabsContent value="wallets"><AgentWalletsTab /></TabsContent>
        <TabsContent value="commission"><AgentCommissionTab /></TabsContent>
        <TabsContent value="areas"><AgentAreasTab /></TabsContent>
        <TabsContent value="settlements"><AgentSettlementsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function AgentListTab() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<Agent | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ phone: "", name: "", business_name: "", territory_code: "", nid_number: "", trade_license: "", max_float: "500000" });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("agents").select("*").order("created_at", { ascending: false });
    if (data) {
      const userIds = data.map(a => a.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, name, phone, balance, avatar_url").in("user_id", userIds);
      const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));
      setAgents(data.map(a => ({ ...a, profile: profileMap[a.user_id] })) as Agent[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = agents.filter(a =>
    !search || a.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.profile?.phone?.includes(search) || a.profile?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const statusCounts = { active: agents.filter(a => a.status === "active").length, pending: agents.filter(a => a.status === "pending").length, suspended: agents.filter(a => a.status === "suspended").length };

  const toggleStatus = async (agent: Agent) => {
    const newStatus = agent.status === "active" ? "suspended" : "active";
    await supabase.from("agents").update({ status: newStatus }).eq("id", agent.id);
    toast.success(`Agent ${newStatus}`);
    load();
  };

  const handleCreateAgent = async () => {
    const phone = form.phone.replace(/\D/g, "").replace(/^88/, "");
    if (!/^01[3-9]\d{8}$/.test(phone)) { toast.error("Enter a valid 11-digit BD phone number"); return; }

    setCreating(true);
    try {
      const pin = String(Math.floor(1000 + Math.random() * 9000));
      const password = pinToPassword(pin);
      const { data: authData } = await signUpWithPhonePassword(phone, password, {
        display_name: form.name || phone,
      });
      if (!authData?.user) throw new Error("Account creation failed");
      const userId = authData.user.id;

      await supabase.from("profiles").update({ name: form.name || null, phone }).eq("user_id", userId);
      await supabase.from("user_roles").insert({ user_id: userId, role: "agent" } as any);
      await supabase.from("agents").insert({
        user_id: userId,
        business_name: form.business_name || null,
        territory_code: form.territory_code || null,
        nid_number: form.nid_number || null,
        trade_license: form.trade_license || null,
        max_float: parseInt(form.max_float) || 500000,
        status: "active",
      });

      toast.success(`Agent created! Temp PIN: ${pin}`, { duration: 10000 });
      setCreateOpen(false);
      setForm({ phone: "", name: "", business_name: "", territory_code: "", nid_number: "", trade_license: "", max_float: "500000" });
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to create agent");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(statusCounts).map(([s, c]) => (
          <Card key={s} className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground capitalize">{s}</p>
              <p className="text-lg font-bold text-foreground">{c}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" /><Input placeholder="Search agents..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Button size="icon" className="shrink-0" onClick={() => setCreateOpen(true)}><UserPlus className="w-4 h-4" /></Button>
      </div>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-3 py-2.5 font-medium text-xs">Agent</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Phone</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Territory</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Commission</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Status</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2.5 font-medium text-foreground text-xs">{a.business_name || a.profile?.name || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{a.profile?.phone || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs hidden sm:table-cell">{a.territory_code || "—"}</td>
                    <td className="px-3 py-2.5 text-emerald-600 text-xs font-semibold hidden sm:table-cell">৳{a.commission_earned.toLocaleString()}</td>
                    <td className="px-3 py-2.5"><Badge className={`text-[10px] ${STATUS_MAP[a.status]?.color || ""}`}>{STATUS_MAP[a.status]?.label || a.status}</Badge></td>
                    <td className="px-3 py-2.5 flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetail(a)}><Eye className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleStatus(a)}>
                        {a.status === "active" ? <XCircle className="w-3.5 h-3.5 text-destructive" /> : <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length === 0 && <EmptyState text="No agents found" />}
        </CardContent>
      </Card>

      {/* Agent Detail Sheet */}
      <Sheet open={!!detail} onOpenChange={o => !o && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle>Agent Details</SheetTitle></SheetHeader>
          {detail && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground text-xs">Business Name</p><p className="font-medium">{detail.business_name || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Phone</p><p className="font-medium">{detail.profile?.phone || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Territory</p><p className="font-medium">{detail.territory_code || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Max Float</p><p className="font-medium">৳{detail.max_float.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground text-xs">Commission Earned</p><p className="font-medium text-emerald-600">৳{detail.commission_earned.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground text-xs">Customers</p><p className="font-medium">{detail.customers_onboarded}</p></div>
                <div><p className="text-muted-foreground text-xs">NID</p><p className="font-medium">{detail.nid_number || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Trade License</p><p className="font-medium">{detail.trade_license || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Wallet Balance</p><p className="font-medium">৳{(detail.profile?.balance ?? 0).toLocaleString()}</p></div>
                <div><p className="text-muted-foreground text-xs">Status</p><Badge className={STATUS_MAP[detail.status]?.color}>{detail.status}</Badge></div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Agent Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Agent</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2 max-h-[60vh] overflow-y-auto">
            <div><Label>Phone Number *</Label><Input placeholder="01XXXXXXXXX" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/[^0-9]/g, "").slice(0, 11) }))} /></div>
            <div><Label>Full Name</Label><Input placeholder="Agent's name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Business Name</Label><Input placeholder="Shop / business name" value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Territory Code</Label><Input placeholder="e.g. DHK-01" value={form.territory_code} onChange={e => setForm(f => ({ ...f, territory_code: e.target.value }))} /></div>
              <div><Label>Max Float</Label><Input type="number" value={form.max_float} onChange={e => setForm(f => ({ ...f, max_float: e.target.value }))} /></div>
            </div>
            <div><Label>NID Number</Label><Input placeholder="National ID" value={form.nid_number} onChange={e => setForm(f => ({ ...f, nid_number: e.target.value }))} /></div>
            <div><Label>Trade License</Label><Input placeholder="Trade license number" value={form.trade_license} onChange={e => setForm(f => ({ ...f, trade_license: e.target.value }))} /></div>
            <Button className="w-full" onClick={handleCreateAgent} disabled={creating || !form.phone}>
              {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : "Create Agent"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgentKycTab() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: agentData } = await supabase.from("agents").select("id, user_id, business_name, status, nid_number");
      if (agentData) {
        const uids = agentData.map(a => a.user_id);
        const [{ data: profiles }, { data: kycs }] = await Promise.all([
          supabase.from("profiles").select("user_id, name, phone").in("user_id", uids),
          supabase.from("kyc_verifications").select("user_id, status, full_name").in("user_id", uids),
        ]);
        const pMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));
        const kMap = Object.fromEntries((kycs ?? []).map(k => [k.user_id, k]));
        setAgents(agentData.map(a => ({ ...a, profile: pMap[a.user_id], kyc: kMap[a.user_id] || null })));
      }
      setLoading(false);
    })();
  }, []);

  const kycStatus = (kyc: any) => kyc?.status || "not_submitted";
  const kycColor = (s: string) => s === "verified" ? "text-emerald-600" : s === "pending" ? "text-amber-600" : "text-red-500";

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-3 py-2.5 font-medium text-xs">Agent</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">NID</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">KYC Status</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">KYC Name</th>
            </tr></thead>
            <tbody>
              {agents.map(a => (
                <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2.5 text-xs font-medium">{a.business_name || a.profile?.name || "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.nid_number || "—"}</td>
                  <td className={`px-3 py-2.5 text-xs font-semibold capitalize ${kycColor(kycStatus(a.kyc))}`}>{kycStatus(a.kyc)}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.kyc?.full_name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && agents.length === 0 && <EmptyState text="No agents registered" />}
      </CardContent>
    </Card>
  );
}

function AgentWalletsTab() {
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: agentData } = await supabase.from("agents").select("id, user_id, business_name, max_float, commission_earned, status");
      if (agentData) {
        const uids = agentData.map(a => a.user_id);
        const { data: profiles } = await supabase.from("profiles").select("user_id, balance, phone").in("user_id", uids);
        const pMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));
        setWallets(agentData.map(a => ({ ...a, balance: pMap[a.user_id]?.balance ?? 0, phone: pMap[a.user_id]?.phone })));
      }
      setLoading(false);
    })();
  }, []);

  const totalFloat = wallets.reduce((s, w) => s + w.balance, 0);
  const totalCommission = wallets.reduce((s, w) => s + w.commission_earned, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Card className="border-0 shadow-[var(--shadow-card)]"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Float</p><p className="text-lg font-bold text-foreground">৳{totalFloat.toLocaleString()}</p></CardContent></Card>
        <Card className="border-0 shadow-[var(--shadow-card)]"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Commission</p><p className="text-lg font-bold text-emerald-600">৳{totalCommission.toLocaleString()}</p></CardContent></Card>
      </div>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-3 py-2.5 font-medium text-xs">Agent</th>
                <th className="text-right px-3 py-2.5 font-medium text-xs">Balance</th>
                <th className="text-right px-3 py-2.5 font-medium text-xs">Max Float</th>
                <th className="text-right px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Utilization</th>
              </tr></thead>
              <tbody>
                {wallets.map(w => {
                  const util = w.max_float > 0 ? ((w.balance / w.max_float) * 100).toFixed(1) : "0";
                  return (
                    <tr key={w.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-3 py-2.5 text-xs font-medium">{w.business_name || w.phone || "—"}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-right">৳{w.balance.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground text-right">৳{w.max_float.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-xs text-right hidden sm:table-cell">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, Number(util))}%` }} /></div>
                          <span className="text-muted-foreground">{util}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && wallets.length === 0 && <EmptyState text="No agent wallets" />}
        </CardContent>
      </Card>
    </div>
  );
}

function AgentAreasTab() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editAgent, setEditAgent] = useState<any>(null);
  const [territory, setTerritory] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("agents").select("id, user_id, business_name, territory_code, status");
      if (data) {
        const uids = data.map(a => a.user_id);
        const { data: profiles } = await supabase.from("profiles").select("user_id, name, phone").in("user_id", uids);
        const pMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));
        setAgents(data.map(a => ({ ...a, profile: pMap[a.user_id] })));
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!editAgent) return;
    await supabase.from("agents").update({ territory_code: territory || null }).eq("id", editAgent.id);
    toast.success("Territory updated");
    setEditAgent(null);
    setAgents(prev => prev.map(a => a.id === editAgent.id ? { ...a, territory_code: territory || null } : a));
  };

  const areaCounts: Record<string, number> = {};
  agents.forEach(a => { const area = a.territory_code || "Unassigned"; areaCounts[area] = (areaCounts[area] || 0) + 1; });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {Object.entries(areaCounts).map(([area, count]) => (
          <Badge key={area} variant="secondary" className="text-xs">{area}: {count}</Badge>
        ))}
      </div>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-3 py-2.5 font-medium text-xs">Agent</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Territory</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Status</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Edit</th>
              </tr></thead>
              <tbody>
                {agents.map(a => (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2.5 text-xs font-medium">{a.business_name || a.profile?.name || "—"}</td>
                    <td className="px-3 py-2.5 text-xs"><Badge variant="outline" className="text-[10px]"><MapPin className="w-3 h-3 mr-1" />{a.territory_code || "Unassigned"}</Badge></td>
                    <td className="px-3 py-2.5"><Badge className={`text-[10px] ${STATUS_MAP[a.status]?.color}`}>{a.status}</Badge></td>
                    <td className="px-3 py-2.5"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditAgent(a); setTerritory(a.territory_code || ""); }}><Pencil className="w-3.5 h-3.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && agents.length === 0 && <EmptyState text="No agents" />}
        </CardContent>
      </Card>

      <Dialog open={!!editAgent} onOpenChange={o => !o && setEditAgent(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Territory — {editAgent?.business_name || "Agent"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>Territory Code</Label><Input placeholder="e.g. DHK-01" value={territory} onChange={e => setTerritory(e.target.value)} /></div>
            <Button className="w-full" onClick={handleSave}>Update Territory</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgentCommissionTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("commission_logs").select("*").order("created_at", { ascending: false }).limit(100);
      if (data) {
        const agentIds = [...new Set(data.filter(l => l.agent_id).map(l => l.agent_id))];
        const { data: agents } = await supabase.from("agents").select("id, business_name").in("id", agentIds);
        const aMap = Object.fromEntries((agents ?? []).map(a => [a.id, a.business_name]));
        setLogs(data.map(l => ({ ...l, agent_name: aMap[l.agent_id] || "—" })));
      }
      setLoading(false);
    })();
  }, []);

  const totalAgent = logs.reduce((s, l) => s + Number(l.agent_amount), 0);
  const byType: Record<string, number> = {};
  logs.forEach(l => { byType[l.txn_type] = (byType[l.txn_type] || 0) + Number(l.agent_amount); });

  return (
    <div className="space-y-3">
      <Card className="border-0 shadow-[var(--shadow-card)]"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Agent Commission</p><p className="text-lg font-bold text-emerald-600">৳{totalAgent.toLocaleString()}</p></CardContent></Card>
      {Object.keys(byType).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(byType).map(([type, amt]) => (
            <Badge key={type} variant="secondary" className="text-xs">{type}: ৳{amt.toLocaleString()}</Badge>
          ))}
        </div>
      )}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-3 py-2.5 font-medium text-xs">Agent</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Type</th>
                <th className="text-right px-3 py-2.5 font-medium text-xs">Txn Amt</th>
                <th className="text-right px-3 py-2.5 font-medium text-xs">Commission</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Date</th>
              </tr></thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2.5 text-xs font-medium">{l.agent_name}</td>
                    <td className="px-3 py-2.5"><Badge variant="secondary" className="text-[10px]">{l.txn_type}</Badge></td>
                    <td className="px-3 py-2.5 text-xs text-right">৳{Number(l.txn_amount).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-right text-emerald-600">৳{Number(l.agent_amount).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{new Date(l.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && logs.length === 0 && <EmptyState text="No commission logs" />}
        </CardContent>
      </Card>
    </div>
  );
}

function AgentSettlementsTab() {
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("settlements").select("*").eq("entity_type", "agent").order("created_at", { ascending: false }).limit(50);
      setSettlements(data ?? []);
      setLoading(false);
    })();
  }, []);

  const totalSettled = settlements.filter(s => s.status === "completed").reduce((sum, s) => sum + Number(s.net_amount), 0);

  return (
    <div className="space-y-3">
      <Card className="border-0 shadow-[var(--shadow-card)]"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Settled (Agent)</p><p className="text-lg font-bold text-foreground">৳{totalSettled.toLocaleString()}</p></CardContent></Card>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-3 py-2.5 font-medium text-xs">Agent</th>
                <th className="text-right px-3 py-2.5 font-medium text-xs">Gross</th>
                <th className="text-right px-3 py-2.5 font-medium text-xs">Net</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Status</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Date</th>
              </tr></thead>
              <tbody>
                {settlements.map(s => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2.5 text-xs font-medium">{s.entity_name || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-right">৳{Number(s.gross_amount).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-xs text-right font-semibold">৳{Number(s.net_amount).toLocaleString()}</td>
                    <td className="px-3 py-2.5"><Badge variant={s.status === "completed" ? "default" : "secondary"} className="text-[10px]">{s.status}</Badge></td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{new Date(s.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && settlements.length === 0 && <EmptyState text="No agent settlements" />}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-8 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </motion.div>
  );
}

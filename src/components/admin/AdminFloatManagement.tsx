import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Landmark, Building2, Store, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

  if (loading) return <Loader />;

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

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("payment_gateways").select("*").order("sort_order");
      setGateways(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loader />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Gateway float allocation overview</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {gateways.map(gw => (
          <Card key={gw.id} className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-foreground">{gw.display_name}</p>
                <Badge variant={gw.is_enabled ? "default" : "secondary"} className="text-[10px]">{gw.is_enabled ? "Active" : "Disabled"}</Badge>
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

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: mData } = await supabase.from("merchants").select("id, user_id, business_name, status, mdr_rate");
      if (mData) {
        const uids = mData.map(m => m.user_id);
        const { data: profiles } = await supabase.from("profiles").select("user_id, balance").in("user_id", uids);
        const pMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));
        setMerchants(mData.map(m => ({ ...m, balance: Number(pMap[m.user_id]?.balance ?? 0) })).sort((a, b) => b.balance - a.balance));
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loader />;
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
            </tr></thead>
            <tbody>
              {merchants.map(m => (
                <tr key={m.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2.5 text-xs font-medium">{m.business_name}</td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-right">৳{m.balance.toLocaleString()}</td>
                  <td className="px-3 py-2.5"><Badge variant={m.status === "active" ? "default" : "secondary"} className="text-[10px]">{m.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          {merchants.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No merchants</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function AgentFloatTab() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: aData } = await supabase.from("agents").select("id, user_id, business_name, max_float, status");
      if (aData) {
        const uids = aData.map(a => a.user_id);
        const { data: profiles } = await supabase.from("profiles").select("user_id, balance").in("user_id", uids);
        const pMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));
        setAgents(aData.map(a => ({ ...a, balance: Number(pMap[a.user_id]?.balance ?? 0) })).sort((a, b) => b.balance - a.balance));
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loader />;
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
                  </tr>
                );
              })}
            </tbody>
          </table>
          {agents.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No agents</p>}
        </CardContent>
      </Card>
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

function Loader() {
  return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
}

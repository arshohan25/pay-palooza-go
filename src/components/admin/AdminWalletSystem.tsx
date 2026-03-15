import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Wallet, Search, Lock, Unlock, Building2, Users, Store, Landmark, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminWalletSystem() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Wallet className="w-5 h-5 text-primary" /> Wallet System
      </h3>
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-auto">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="users" className="text-xs">Users</TabsTrigger>
          <TabsTrigger value="agents" className="text-xs">Agents</TabsTrigger>
          <TabsTrigger value="merchants" className="text-xs">Merchants</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><WalletOverview /></TabsContent>
        <TabsContent value="users"><WalletList type="user" /></TabsContent>
        <TabsContent value="agents"><WalletList type="agent" /></TabsContent>
        <TabsContent value="merchants"><WalletList type="merchant" /></TabsContent>
      </Tabs>
    </div>
  );
}

function WalletOverview() {
  const [stats, setStats] = useState({ totalUsers: 0, totalUserBalance: 0, totalAgents: 0, totalAgentBalance: 0, totalMerchants: 0, totalMerchantBalance: 0, treasuryBalance: 0, frozenCount: 0 });

  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: agents }, { data: merchants }, { data: treasury }, { count: frozen }] = await Promise.all([
        supabase.from("profiles").select("balance"),
        supabase.from("agents").select("user_id").eq("status", "active"),
        supabase.from("merchants").select("user_id").eq("status", "active"),
        supabase.from("platform_treasury").select("balance").limit(1).single(),
        supabase.from("profiles").select("id", { count: "exact", head: true }).in("status", ["suspended", "deactivated"]),
      ]);

      const agentUids = new Set((agents ?? []).map(a => a.user_id));
      const merchantUids = new Set((merchants ?? []).map(m => m.user_id));
      let totalUser = 0, totalAgent = 0, totalMerchant = 0, userCount = 0;
      (profiles ?? []).forEach(p => {
        const b = Number(p.balance);
        if (agentUids.has((p as any).user_id)) { totalAgent += b; }
        else if (merchantUids.has((p as any).user_id)) { totalMerchant += b; }
        else { totalUser += b; userCount++; }
      });

      // Re-fetch with user_id for proper categorization
      const { data: allProfiles } = await supabase.from("profiles").select("user_id, balance");
      let uBal = 0, aBal = 0, mBal = 0;
      (allProfiles ?? []).forEach(p => {
        const b = Number(p.balance);
        if (agentUids.has(p.user_id)) aBal += b;
        else if (merchantUids.has(p.user_id)) mBal += b;
        else uBal += b;
      });

      setStats({
        totalUsers: (allProfiles ?? []).length - agentUids.size - merchantUids.size,
        totalUserBalance: uBal,
        totalAgents: agentUids.size,
        totalAgentBalance: aBal,
        totalMerchants: merchantUids.size,
        totalMerchantBalance: mBal,
        treasuryBalance: Number(treasury?.balance ?? 0),
        frozenCount: frozen ?? 0,
      });
    })();
  }, []);

  const cards = [
    { label: "System Treasury", value: stats.treasuryBalance, icon: Landmark, color: "text-purple-600" },
    { label: "User Wallets", value: stats.totalUserBalance, icon: Users, color: "text-blue-600", sub: `${stats.totalUsers} users` },
    { label: "Agent Wallets", value: stats.totalAgentBalance, icon: Building2, color: "text-emerald-600", sub: `${stats.totalAgents} agents` },
    { label: "Merchant Wallets", value: stats.totalMerchantBalance, icon: Store, color: "text-amber-600", sub: `${stats.totalMerchants} merchants` },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {cards.map(c => (
          <Card key={c.label} className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-3">
              <c.icon className={`w-4 h-4 mb-1 ${c.color}`} />
              <p className="text-[10px] text-muted-foreground">{c.label}</p>
              <p className={`text-sm font-bold ${c.color}`}>৳{c.value.toLocaleString()}</p>
              {c.sub && <p className="text-[10px] text-muted-foreground">{c.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
      {stats.frozenCount > 0 && (
        <Card className="border-0 shadow-[var(--shadow-card)] bg-destructive/5">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <p className="text-xs text-foreground"><span className="font-bold">{stats.frozenCount}</span> frozen/suspended wallets</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WalletList({ type }: { type: "user" | "agent" | "merchant" }) {
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      if (type === "user") {
        const { data } = await supabase.from("profiles").select("user_id, name, phone, balance, status").order("balance", { ascending: false }).limit(100);
        setWallets(data ?? []);
      } else if (type === "agent") {
        const { data: agents } = await supabase.from("agents").select("user_id, business_name, status");
        if (agents) {
          const uids = agents.map(a => a.user_id);
          const { data: profiles } = await supabase.from("profiles").select("user_id, phone, balance, status").in("user_id", uids);
          const pMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));
          setWallets(agents.map(a => ({ ...a, ...pMap[a.user_id], name: a.business_name })).sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0)));
        }
      } else {
        const { data: merchants } = await supabase.from("merchants").select("user_id, business_name, status");
        if (merchants) {
          const uids = merchants.map(m => m.user_id);
          const { data: profiles } = await supabase.from("profiles").select("user_id, phone, balance, status").in("user_id", uids);
          const pMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));
          setWallets(merchants.map(m => ({ ...m, ...pMap[m.user_id], name: m.business_name })).sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0)));
        }
      }
      setLoading(false);
    })();
  }, [type]);

  const filtered = wallets.filter(w =>
    !search || w.name?.toLowerCase().includes(search.toLowerCase()) || w.phone?.includes(search)
  );

  const totalBalance = filtered.reduce((s, w) => s + Number(w.balance ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" /><Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Badge variant="secondary" className="text-xs">Total: ৳{totalBalance.toLocaleString()}</Badge>
      </div>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-3 py-2.5 font-medium text-xs">Name</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Phone</th>
                <th className="text-right px-3 py-2.5 font-medium text-xs">Balance</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Status</th>
              </tr></thead>
              <tbody>
                {filtered.slice(0, 50).map((w, i) => (
                  <tr key={w.user_id || i} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2.5 text-xs font-medium">{w.name || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{w.phone || "—"}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-right">৳{Number(w.balance ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2.5">
                      {w.status === "suspended" || w.status === "deactivated" ? (
                        <Badge variant="destructive" className="text-[10px]"><Lock className="w-3 h-3 mr-1" />Frozen</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Active</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No wallets found</div>}
        </CardContent>
      </Card>
    </div>
  );
}

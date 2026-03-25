import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, Search, Lock, Unlock, Building2, Users, Store, Landmark, AlertTriangle, Plus, Minus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminWalletSystem() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Wallet className="w-5 h-5 text-primary" /> Wallet System
      </h3>
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full grid grid-cols-3 sm:grid-cols-6 h-auto">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="users" className="text-xs">Users</TabsTrigger>
          <TabsTrigger value="agents" className="text-xs">Agents</TabsTrigger>
          <TabsTrigger value="merchants" className="text-xs">Merchants</TabsTrigger>
          <TabsTrigger value="freeze" className="text-xs">Freeze</TabsTrigger>
          <TabsTrigger value="adjustments" className="text-xs">Adjust</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><WalletOverview /></TabsContent>
        <TabsContent value="users"><WalletList type="user" /></TabsContent>
        <TabsContent value="agents"><WalletList type="agent" /></TabsContent>
        <TabsContent value="merchants"><WalletList type="merchant" /></TabsContent>
        <TabsContent value="freeze"><FreezeUnfreezeTab /></TabsContent>
        <TabsContent value="adjustments"><AdjustmentsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function WalletOverview() {
  const [stats, setStats] = useState({ totalUsers: 0, totalUserBalance: 0, totalAgents: 0, totalAgentBalance: 0, totalMerchants: 0, totalMerchantBalance: 0, treasuryBalance: 0, frozenCount: 0 });

  useEffect(() => {
    (async () => {
      const [{ data: agents }, { data: merchants }, { data: treasury }, { count: frozen }] = await Promise.all([
        supabase.from("agents").select("user_id").eq("status", "active"),
        supabase.from("merchants").select("user_id").eq("status", "active"),
        supabase.from("platform_treasury").select("balance").limit(1).single(),
        supabase.from("profiles").select("id", { count: "exact", head: true }).in("status", ["suspended", "deactivated"]),
      ]);
      const agentUids = new Set((agents ?? []).map(a => a.user_id));
      const merchantUids = new Set((merchants ?? []).map(m => m.user_id));
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
        totalUserBalance: uBal, totalAgents: agentUids.size, totalAgentBalance: aBal,
        totalMerchants: merchantUids.size, totalMerchantBalance: mBal,
        treasuryBalance: Number(treasury?.balance ?? 0), frozenCount: frozen ?? 0,
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

  const filtered = wallets.filter(w => !search || w.name?.toLowerCase().includes(search.toLowerCase()) || w.phone?.includes(search));
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

function FreezeUnfreezeTab() {
  const [phone, setPhone] = useState("");
  const [found, setFound] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [reason, setReason] = useState("");
  const [frozenList, setFrozenList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("profiles").select("user_id, name, phone, balance, status").in("status", ["suspended", "deactivated"]).order("updated_at", { ascending: false }).limit(50);
      setFrozenList(data ?? []);
      setLoading(false);
    })();
  }, []);

  const searchUser = async () => {
    if (!phone) return;
    setSearching(true);
    const { data } = await supabase.from("profiles").select("user_id, name, phone, balance, status").eq("phone", phone).maybeSingle();
    setFound(data);
    if (!data) toast.error("User not found");
    setSearching(false);
  };

  const toggleFreeze = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    const { error } = await supabase.from("profiles").update({ status: newStatus }).eq("user_id", userId);
    if (error) { toast.error("Failed"); return; }

    const { data: { session } } = await supabase.auth.getSession();
    supabase.from("audit_logs").insert({
      actor_id: session?.user?.id ?? "",
      action: newStatus === "suspended" ? "wallet_frozen" : "wallet_unfrozen",
      entity_type: "profile", entity_id: userId,
      details: { reason: reason || "Admin action" },
    }).then();

    toast.success(newStatus === "suspended" ? "Wallet frozen" : "Wallet unfrozen");
    setFound(null); setPhone(""); setReason("");
    const { data: fresh } = await supabase.from("profiles").select("user_id, name, phone, balance, status").in("status", ["suspended", "deactivated"]).order("updated_at", { ascending: false }).limit(50);
    setFrozenList(fresh ?? []);
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Search & Freeze/Unfreeze Wallet</p>
          <div className="flex gap-2">
            <Input placeholder="Enter phone number..." value={phone} onChange={e => setPhone(e.target.value)} className="flex-1" />
            <Button onClick={searchUser} disabled={searching}>{searching ? "..." : "Search"}</Button>
          </div>
          {found && (
            <Card className="border bg-muted/30">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{found.name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{found.phone} • ৳{Number(found.balance).toLocaleString()}</p>
                  </div>
                  <Badge variant={found.status === "active" ? "default" : "destructive"} className="text-xs">{found.status}</Badge>
                </div>
                <Input placeholder="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} />
                <Button
                  variant={found.status === "active" ? "destructive" : "default"}
                  className="w-full gap-2"
                  onClick={() => toggleFreeze(found.user_id, found.status)}
                >
                  {found.status === "active" ? <><Lock className="w-4 h-4" /> Freeze Wallet</> : <><Unlock className="w-4 h-4" /> Unfreeze Wallet</>}
                </Button>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <p className="text-sm font-medium text-foreground">Currently Frozen Wallets ({frozenList.length})</p>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-3 py-2.5 font-medium text-xs">Name</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">Phone</th>
              <th className="text-right px-3 py-2.5 font-medium text-xs">Balance</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">Action</th>
            </tr></thead>
            <tbody>
              {frozenList.map(w => (
                <tr key={w.user_id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2.5 text-xs font-medium">{w.name || "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{w.phone}</td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-right">৳{Number(w.balance).toLocaleString()}</td>
                  <td className="px-3 py-2.5">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => toggleFreeze(w.user_id, w.status)}>
                      <Unlock className="w-3 h-3" /> Unfreeze
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && frozenList.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No frozen wallets</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function AdjustmentsTab() {
  const [phone, setPhone] = useState("");
  const [found, setFound] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [adjustType, setAdjustType] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [recentAdjustments, setRecentAdjustments] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("audit_logs").select("*")
        .in("action", ["wallet_credit_adjustment", "wallet_debit_adjustment"])
        .order("created_at", { ascending: false }).limit(20);
      setRecentAdjustments(data ?? []);
    })();
  }, []);

  const searchUser = async () => {
    if (!phone) return;
    setSearching(true);
    const { data } = await supabase.from("profiles").select("user_id, name, phone, balance, status").eq("phone", phone).maybeSingle();
    setFound(data);
    if (!data) toast.error("User not found");
    setSearching(false);
  };

  const handleAdjust = async () => {
    if (!found || !amount || !reason) return;
    setAdjusting(true);
    try {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) throw new Error("Invalid amount");

      const currentBalance = Number(found.balance);
      const newBalance = adjustType === "credit" ? currentBalance + numAmount : currentBalance - numAmount;
      if (newBalance < 0) throw new Error("Insufficient balance for debit");

      const { error } = await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", found.user_id);
      if (error) throw error;

      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from("audit_logs").insert({
        actor_id: session?.user?.id ?? "",
        action: `wallet_${adjustType}_adjustment`,
        entity_type: "profile", entity_id: found.user_id,
        details: { amount: numAmount, reason, old_balance: currentBalance, new_balance: newBalance },
      });

      toast.success(`৳${numAmount.toLocaleString()} ${adjustType}ed to ${found.name || found.phone}`);
      setShowConfirm(false); setFound(null); setPhone(""); setAmount(""); setReason("");

      const { data: fresh } = await supabase.from("audit_logs").select("*")
        .in("action", ["wallet_credit_adjustment", "wallet_debit_adjustment"])
        .order("created_at", { ascending: false }).limit(20);
      setRecentAdjustments(fresh ?? []);
    } catch (err: any) {
      toast.error(err.message || "Adjustment failed");
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Manual Balance Adjustment</p>
          <div className="flex gap-2">
            <Input placeholder="Enter phone number..." value={phone} onChange={e => setPhone(e.target.value)} className="flex-1" />
            <Button onClick={searchUser} disabled={searching}>{searching ? "..." : "Search"}</Button>
          </div>
          {found && (
            <Card className="border bg-muted/30">
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{found.name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{found.phone}</p>
                  </div>
                  <p className="text-sm font-bold text-foreground">৳{Number(found.balance).toLocaleString()}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-1 flex gap-0.5">
                  <button className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${adjustType === "credit" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setAdjustType("credit")}><Plus className="w-3 h-3" />Credit</button>
                  <button className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${adjustType === "debit" ? "bg-destructive text-destructive-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setAdjustType("debit")}><Minus className="w-3 h-3" />Debit</button>
                </div>
                <Input type="number" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} />
                <Input placeholder="Reason (required)" value={reason} onChange={e => setReason(e.target.value)} />
                <Button className="w-full" disabled={!amount || !reason} onClick={() => setShowConfirm(true)}>
                  Preview Adjustment
                </Button>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {recentAdjustments.length > 0 && (
        <>
          <p className="text-sm font-medium text-foreground">Recent Adjustments</p>
          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-3 py-2.5 font-medium text-xs">Type</th>
                  <th className="text-left px-3 py-2.5 font-medium text-xs">Details</th>
                  <th className="text-left px-3 py-2.5 font-medium text-xs">Time</th>
                </tr></thead>
                <tbody>
                  {recentAdjustments.map(a => (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-3 py-2.5">
                        <Badge variant={a.action.includes("credit") ? "default" : "destructive"} className="text-[10px]">
                          {a.action.includes("credit") ? "Credit" : "Debit"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        ৳{(a.details as any)?.amount?.toLocaleString() ?? "—"} — {(a.details as any)?.reason || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Adjustment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">User:</span> {found?.name || found?.phone}</p>
              <p><span className="text-muted-foreground">Current Balance:</span> ৳{Number(found?.balance ?? 0).toLocaleString()}</p>
              <p><span className="text-muted-foreground">Type:</span> <Badge variant={adjustType === "credit" ? "default" : "destructive"} className="text-xs">{adjustType}</Badge></p>
              <p><span className="text-muted-foreground">Amount:</span> ৳{Number(amount || 0).toLocaleString()}</p>
              <p><span className="text-muted-foreground">New Balance:</span> <span className="font-bold">
                ৳{(adjustType === "credit" ? Number(found?.balance ?? 0) + Number(amount || 0) : Number(found?.balance ?? 0) - Number(amount || 0)).toLocaleString()}
              </span></p>
              <p><span className="text-muted-foreground">Reason:</span> {reason}</p>
            </div>
            <Button className="w-full" onClick={handleAdjust} disabled={adjusting}>
              {adjusting ? "Processing..." : `Confirm ${adjustType === "credit" ? "Credit" : "Debit"}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

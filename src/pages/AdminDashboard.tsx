import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users, ArrowLeftRight, ShieldAlert, Store, UserCheck,
  TrendingUp, Activity, Search, RefreshCw, LogOut,
  LayoutDashboard, UserCog, Receipt, AlertTriangle, Settings,
  ChevronLeft, Coins, Scale, BarChart3, MessageCircle, Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useAdmin, fetchAdminStats, fetchRecentTransactions, fetchAllUsers, fetchFraudAlerts, fetchAllAgents, fetchAllMerchants, toggleUserStatus, toggleAgentStatus, toggleMerchantStatus } from "@/hooks/use-admin";
import { toast } from "sonner";
import { signOut } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import AdminChargeConfig from "@/components/admin/AdminChargeConfig";
import AdminCommissionSetup from "@/components/admin/AdminCommissionSetup";
import AdminDisputeResolution from "@/components/admin/AdminDisputeResolution";
import AdminReporting from "@/components/admin/AdminReporting";
import AdminSupportDashboard from "@/components/admin/AdminSupportDashboard";
import AdminFeatureLocks from "@/components/admin/AdminFeatureLocks";
import AdminFraudAlerts from "@/components/admin/AdminFraudAlerts";
import UserLockDialog from "@/components/admin/UserLockDialog";
import { useSupportNotifications } from "@/hooks/use-support-notifications";

interface Stats {
  totalUsers: number;
  totalTransactions: number;
  totalAgents: number;
  totalMerchants: number;
  openAlerts: number;
}

const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) => (
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

const TXN_TYPE_COLORS: Record<string, string> = {
  send: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  receive: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  cashout: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  cashin: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  payment: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  recharge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  paybill: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  addmoney: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  banktransfer: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
};

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  investigating: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  false_positive: "bg-muted text-muted-foreground",
};

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: UserCog },
  { id: "transactions", label: "Transactions", icon: Receipt },
  { id: "alerts", label: "Fraud", icon: AlertTriangle },
  { id: "charges", label: "Charges", icon: Settings },
  { id: "commissions", label: "Commissions", icon: Coins },
  { id: "disputes", label: "Disputes", icon: Scale },
  { id: "support", label: "Support", icon: MessageCircle },
  { id: "locks", label: "Locks", icon: Lock },
  { id: "reporting", label: "Reports", icon: BarChart3 },
];

export default function AdminDashboard() {
  const { isAdmin, loading: authLoading } = useAdmin();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const { unreadCount: supportUnread } = useSupportNotifications(activeTab);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalTransactions: 0, totalAgents: 0, totalMerchants: 0, openAlerts: 0 });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [userSubTab, setUserSubTab] = useState<"users" | "agents" | "merchants">("users");
  const [lockTarget, setLockTarget] = useState<{ userId: string; label: string } | null>(null);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    const [s, t, u, a, ag, m] = await Promise.all([
      fetchAdminStats(),
      fetchRecentTransactions(50),
      fetchAllUsers(100),
      fetchFraudAlerts(50),
      fetchAllAgents(100),
      fetchAllMerchants(100),
    ]);
    setStats(s);
    setTransactions(t);
    setUsers(u);
    setAlerts(a);
    setAgents(ag);
    setMerchants(m);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/");
      return;
    }
    if (isAdmin) loadData();
  }, [isAdmin, authLoading, navigate, loadData]);

  // Real-time fraud alert notifications
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-fraud-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "fraud_alerts" },
        (payload) => {
          const alert = payload.new as any;
          const severity = alert.severity ?? "medium";
          const rule = alert.rule_triggered ?? "Unknown rule";
          const toastFn = severity === "critical" || severity === "high" ? toast.error : toast.warning;
          toastFn(`🚨 New Fraud Alert: ${rule}`, {
            description: `Severity: ${severity.toUpperCase()}`,
            duration: 8000,
            action: { label: "View", onClick: () => setActiveTab("alerts") },
          });
          // Refresh stats to update the open alerts badge
          fetchAdminStats().then(s => setStats(s));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const filteredUsers = users.filter(u =>
    !searchQuery || u.phone?.includes(searchQuery) || u.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTxns = transactions.filter(t =>
    !searchQuery || t.id?.includes(searchQuery) || t.recipient_phone?.includes(searchQuery) || t.type?.includes(searchQuery)
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card p-4 gap-1 fixed inset-y-0 left-0 z-30">
        <div className="flex items-center gap-3 px-3 py-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-foreground text-lg leading-tight">Admin</h1>
            <p className="text-xs text-muted-foreground">EasyPay Backoffice</p>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-1">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === item.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
                {item.id === "alerts" && stats.openAlerts > 0 && (
                  <Badge variant="destructive" className="ml-auto text-xs px-1.5 py-0">
                    {stats.openAlerts}
                  </Badge>
                )}
                {item.id === "support" && supportUnread > 0 && (
                  <Badge className="ml-auto text-xs px-1.5 py-0 bg-primary text-primary-foreground">
                    {supportUnread}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="mt-auto space-y-2 pt-4 border-t border-border">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" onClick={() => navigate("/")}>
            <ChevronLeft className="w-4 h-4" /> Back to App
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" onClick={() => signOut()}>
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-8 overflow-auto md:ml-64">
        {/* Mobile nav */}
        <div className="md:hidden mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-bold text-lg text-foreground">Admin</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={loadData} disabled={refreshing}>
            <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Mobile tabs - horizontally scrollable */}
        <div className="md:hidden mb-4">
          <ScrollArea className="w-full">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="inline-flex w-auto gap-1">
                {NAV_ITEMS.map(item => (
                  <TabsTrigger key={item.id} value={item.id} className="text-xs whitespace-nowrap relative">
                    <item.icon className="w-3.5 h-3.5 mr-1" />
                    {item.label}
                    {item.id === "support" && supportUnread > 0 && (
                      <span className="ml-1 min-w-[16px] h-4 px-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-full inline-flex items-center justify-center">
                        {supportUnread}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        {/* Header bar (desktop) */}
        <div className="hidden md:flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-foreground capitalize">{activeTab === "alerts" ? "Fraud Detection" : activeTab}</h2>
            <p className="text-sm text-muted-foreground">EasyPay MFS Admin Backoffice</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users, transactions…"
                className="pl-10 w-72"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" onClick={loadData} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* ═══ OVERVIEW ═══ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <StatCard icon={Users} label="Total Users" value={stats.totalUsers} color="bg-primary" />
              <StatCard icon={ArrowLeftRight} label="Transactions" value={stats.totalTransactions} color="bg-blue-500" />
              <StatCard icon={UserCheck} label="Agents" value={stats.totalAgents} color="bg-emerald-500" />
              <StatCard icon={Store} label="Merchants" value={stats.totalMerchants} color="bg-purple-500" />
              <StatCard icon={ShieldAlert} label="Open Alerts" value={stats.openAlerts} color="bg-destructive" />
            </div>

            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Recent Transactions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left px-4 py-3 font-medium">Type</th>
                        <th className="text-left px-4 py-3 font-medium">Amount</th>
                        <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Recipient</th>
                        <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Status</th>
                        <th className="text-left px-4 py-3 font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.slice(0, 10).map((txn: any) => (
                        <tr key={txn.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className={`text-xs ${TXN_TYPE_COLORS[txn.type] ?? ""}`}>
                              {txn.type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">৳{txn.amount?.toLocaleString()}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{txn.recipient_phone || "—"}</td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <Badge variant="outline" className="text-xs">{txn.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {new Date(txn.created_at).toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {transactions.length === 0 && (
                  <p className="text-center text-muted-foreground py-8 text-sm">No transactions yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══ USER MANAGEMENT ═══ */}
        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {(["users", "agents", "merchants"] as const).map(tab => (
                <Button
                  key={tab}
                  variant={userSubTab === tab ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUserSubTab(tab)}
                  className="capitalize"
                >
                  {tab}
                </Button>
              ))}
            </div>

            {/* Users sub-tab */}
            {userSubTab === "users" && (
              <Card className="border-0 shadow-[var(--shadow-card)]">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">All Users</CardTitle>
                  <div className="md:hidden relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search…" className="pl-10 w-48" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left px-4 py-3 font-medium">Name</th>
                          <th className="text-left px-4 py-3 font-medium">Phone</th>
                          <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Balance</th>
                          <th className="text-left px-4 py-3 font-medium">Status</th>
                          <th className="text-left px-4 py-3 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((user: any) => (
                          <tr key={user.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">{user.name || "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground">{user.phone}</td>
                            <td className="px-4 py-3 font-semibold text-foreground hidden md:table-cell">৳{parseFloat(user.balance).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <Badge variant={user.status === "suspended" ? "destructive" : "secondary"} className="text-xs">
                                {user.status || "active"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant={user.status === "suspended" ? "default" : "destructive"}
                                className="text-xs h-7"
                                onClick={async () => {
                                  try {
                                    const ns = await toggleUserStatus(user.user_id, user.status || "active");
                                    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: ns } : u));
                                    toast.success(`User ${ns}`);
                                  } catch { toast.error("Failed to update status"); }
                                }}
                              >
                                {user.status === "suspended" ? "Activate" : "Suspend"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 gap-1"
                                onClick={() => setLockTarget({ userId: user.user_id, label: `${user.name || "User"} (${user.phone})` })}
                              >
                                <Lock className="w-3 h-3" /> Lock
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredUsers.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No users found</p>}
                </CardContent>
              </Card>
            )}

            {/* Agents sub-tab */}
            {userSubTab === "agents" && (
              <Card className="border-0 shadow-[var(--shadow-card)]">
                <CardHeader className="pb-2"><CardTitle className="text-base">Agent Management</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left px-4 py-3 font-medium">Business</th>
                          <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Territory</th>
                          <th className="text-left px-4 py-3 font-medium">Status</th>
                          <th className="text-left px-4 py-3 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agents.map((agent: any) => (
                          <tr key={agent.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">{agent.business_name || "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{agent.territory_code || "—"}</td>
                            <td className="px-4 py-3">
                              <Badge variant={agent.status === "suspended" ? "destructive" : agent.status === "active" ? "secondary" : "outline"} className="text-xs">
                                {agent.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant={agent.status === "suspended" ? "default" : "destructive"}
                                className="text-xs h-7"
                                onClick={async () => {
                                  try {
                                    const ns = await toggleAgentStatus(agent.id, agent.status);
                                    setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: ns } : a));
                                    toast.success(`Agent ${ns}`);
                                  } catch { toast.error("Failed to update status"); }
                                }}
                              >
                                {agent.status === "suspended" ? "Activate" : "Suspend"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 gap-1"
                                onClick={() => setLockTarget({ userId: agent.user_id, label: `${agent.business_name || "Agent"} (${agent.territory_code || agent.id.slice(0, 8)})` })}
                              >
                                <Lock className="w-3 h-3" /> Lock
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {agents.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No agents found</p>}
                </CardContent>
              </Card>
            )}

            {/* Merchants sub-tab */}
            {userSubTab === "merchants" && (
              <Card className="border-0 shadow-[var(--shadow-card)]">
                <CardHeader className="pb-2"><CardTitle className="text-base">Merchant Management</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left px-4 py-3 font-medium">Business</th>
                          <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Category</th>
                          <th className="text-left px-4 py-3 font-medium">Status</th>
                          <th className="text-left px-4 py-3 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {merchants.map((m: any) => (
                          <tr key={m.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">{m.business_name}</td>
                            <td className="px-4 py-3 text-muted-foreground capitalize hidden md:table-cell">{m.category}</td>
                            <td className="px-4 py-3">
                              <Badge variant={m.status === "suspended" ? "destructive" : m.status === "active" ? "secondary" : "outline"} className="text-xs">
                                {m.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant={m.status === "suspended" ? "default" : "destructive"}
                                className="text-xs h-7"
                                onClick={async () => {
                                  try {
                                    const ns = await toggleMerchantStatus(m.id, m.status);
                                    setMerchants(prev => prev.map(x => x.id === m.id ? { ...x, status: ns } : x));
                                    toast.success(`Merchant ${ns}`);
                                  } catch { toast.error("Failed to update status"); }
                                }}
                              >
                                {m.status === "suspended" ? "Activate" : "Suspend"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 gap-1"
                                onClick={() => setLockTarget({ userId: m.user_id, label: `${m.business_name} (${m.category})` })}
                              >
                                <Lock className="w-3 h-3" /> Lock
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {merchants.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No merchants found</p>}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ═══ TRANSACTION MONITORING ═══ */}
        {activeTab === "transactions" && (
          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Transaction Monitor</CardTitle>
              <div className="md:hidden relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search…" className="pl-10 w-48" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left px-4 py-3 font-medium">ID</th>
                      <th className="text-left px-4 py-3 font-medium">Type</th>
                      <th className="text-left px-4 py-3 font-medium">Amount</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Fee</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Recipient</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTxns.map((txn: any) => (
                      <tr key={txn.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{txn.id?.slice(0, 8)}…</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className={`text-xs ${TXN_TYPE_COLORS[txn.type] ?? ""}`}>
                            {txn.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">৳{txn.amount?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">৳{txn.fee?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{txn.recipient_phone || "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">{txn.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                          {new Date(txn.created_at).toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredTxns.length === 0 && (
                <p className="text-center text-muted-foreground py-8 text-sm">No transactions found</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ═══ FRAUD DETECTION ═══ */}
        {activeTab === "alerts" && <AdminFraudAlerts />}

        {/* ═══ CHARGE CONFIGURATION ═══ */}
        {activeTab === "charges" && <AdminChargeConfig />}

        {/* ═══ COMMISSION SETUP ═══ */}
        {activeTab === "commissions" && <AdminCommissionSetup />}

        {/* ═══ DISPUTE RESOLUTION ═══ */}
        {activeTab === "disputes" && <AdminDisputeResolution />}

        {/* ═══ SUPPORT DASHBOARD ═══ */}
        {activeTab === "support" && <AdminSupportDashboard />}

        {/* ═══ FEATURE LOCKS ═══ */}
        {activeTab === "locks" && <AdminFeatureLocks />}

        {/* ═══ REPORTING DASHBOARD ═══ */}
        {activeTab === "reporting" && <AdminReporting />}
      </main>

      {/* User Lock Dialog - accessible from any user/agent/merchant row */}
      <UserLockDialog
        open={!!lockTarget}
        onOpenChange={(o) => { if (!o) setLockTarget(null); }}
        targetUserId={lockTarget?.userId ?? ""}
        targetLabel={lockTarget?.label ?? ""}
        onLocked={() => setLockTarget(null)}
      />
    </div>
  );
}

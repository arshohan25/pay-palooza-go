import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users, ArrowLeftRight, ShieldAlert, Store, UserCheck,
  TrendingUp, Activity, Search, RefreshCw, LogOut,
  LayoutDashboard, UserCog, Receipt, AlertTriangle, Settings,
  ChevronLeft, Coins, Scale, BarChart3, MessageCircle, Lock, RotateCcw, Package, CreditCard, ToggleRight, Smartphone,
  Menu, ScanFace,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import AdminActivityMonitor from "@/components/admin/AdminActivityMonitor";
import AdminChargebackDialog from "@/components/admin/AdminChargebackDialog";
import AdminChargebackHistory from "@/components/admin/AdminChargebackHistory";
import UserLockDialog from "@/components/admin/UserLockDialog";
import AdminOrderManagement from "@/components/admin/AdminOrderManagement";
import AdminGatewayConfig from "@/components/admin/AdminGatewayConfig";
import AdminGlobalToggles from "@/components/admin/AdminGlobalToggles";
import AdminRechargePackManager from "@/components/admin/AdminRechargePackManager";
import AdminRechargeAnalytics from "@/components/admin/AdminRechargeAnalytics";
import AdminRechargeImportExport from "@/components/admin/AdminRechargeImportExport";
import AdminRechargeApiConnect from "@/components/admin/AdminRechargeApiConnect";
import AdminRechargeLog from "@/components/admin/AdminRechargeLog";
import AdminKycReview from "@/components/admin/AdminKycReview";
import { useSupportNotifications } from "@/hooks/use-support-notifications";

interface Stats {
  totalUsers: number;
  totalTransactions: number;
  totalAgents: number;
  totalMerchants: number;
  openAlerts: number;
  pendingKyc: number;
}

const RechargeSection = () => {
  const [subTab, setSubTab] = useState<"packs" | "analytics" | "import" | "apiconnect" | "log">("packs");
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "packs" as const, label: "Manage Packs" },
          { key: "analytics" as const, label: "Analytics" },
          { key: "log" as const, label: "Txn Log" },
          { key: "import" as const, label: "Import / Export" },
          { key: "apiconnect" as const, label: "API Connect" },
        ].map(t => (
          <Button
            key={t.key}
            variant={subTab === t.key ? "default" : "outline"}
            size="sm"
            onClick={() => setSubTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>
      {subTab === "packs" && <AdminRechargePackManager />}
      {subTab === "analytics" && <AdminRechargeAnalytics />}
      {subTab === "log" && <AdminRechargeLog />}
      {subTab === "import" && <AdminRechargeImportExport />}
      {subTab === "apiconnect" && <AdminRechargeApiConnect />}
    </div>
  );
};


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
  chargeback: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
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
  { id: "chargebacks", label: "Chargebacks", icon: RotateCcw },
  { id: "alerts", label: "Fraud", icon: AlertTriangle },
  { id: "charges", label: "Charges", icon: Settings },
  { id: "commissions", label: "Commissions", icon: Coins },
  { id: "disputes", label: "Disputes", icon: Scale },
  { id: "support", label: "Support", icon: MessageCircle },
  { id: "locks", label: "Locks", icon: Lock },
  { id: "orders", label: "Orders", icon: Package },
  { id: "gateways", label: "Gateways", icon: CreditCard },
  { id: "toggles", label: "Toggles", icon: ToggleRight },
  { id: "recharge", label: "Recharge", icon: Smartphone },
  { id: "kyc", label: "KYC", icon: ScanFace },
  { id: "reporting", label: "Reports", icon: BarChart3 },
];

export default function AdminDashboard() {
  const { isAdmin, loading: authLoading } = useAdmin();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const { unreadCount: supportUnread } = useSupportNotifications(activeTab);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalTransactions: 0, totalAgents: 0, totalMerchants: 0, openAlerts: 0, pendingKyc: 0 });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [userSubTab, setUserSubTab] = useState<"users" | "agents" | "merchants">("users");
  const [lockTarget, setLockTarget] = useState<{ userId: string; label: string } | null>(null);
  const [chargebackTarget, setChargebackTarget] = useState<any>(null);
  const [showNavMenu, setShowNavMenu] = useState(false);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    const [s, t, u, a, ag, m, kycRes] = await Promise.all([
      fetchAdminStats(),
      fetchRecentTransactions(50),
      fetchAllUsers(100),
      fetchFraudAlerts(50),
      fetchAllAgents(100),
      fetchAllMerchants(100),
      supabase.from("kyc_verifications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    setStats({ ...s, pendingKyc: kycRes.count ?? 0 });
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

  // Real-time: listen to all key tables for live admin updates
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-global-realtime")
      // New fraud alerts → toast + refresh stats
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "fraud_alerts" }, (payload) => {
        const alert = payload.new as any;
        const severity = alert.severity ?? "medium";
        const rule = alert.rule_triggered ?? "Unknown rule";
        const toastFn = severity === "critical" || severity === "high" ? toast.error : toast.warning;
        toastFn(`🚨 New Fraud Alert: ${rule}`, {
          description: `Severity: ${severity.toUpperCase()}`,
          duration: 8000,
          action: { label: "View", onClick: () => setActiveTab("alerts") },
        });
        loadData();
      })
      // Fraud alert status changes
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "fraud_alerts" }, () => {
        fetchAdminStats().then(s => setStats(prev => ({ ...s, pendingKyc: prev.pendingKyc })));
      })
      // New transactions → refresh overview stats + transaction list
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, () => {
        loadData();
      })
      // Profile changes (status, balance) → refresh user list + stats
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        fetchAllUsers(100).then(u => setUsers(u));
        fetchAdminStats().then(s => setStats(prev => ({ ...s, pendingKyc: prev.pendingKyc })));
      })
      // New profiles → refresh stats
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, () => {
        fetchAdminStats().then(s => setStats(prev => ({ ...s, pendingKyc: prev.pendingKyc })));
        fetchAllUsers(100).then(u => setUsers(u));
      })
      // Feature lock changes
      .on("postgres_changes", { event: "*", schema: "public", table: "feature_locks" }, () => {
        // Admin locks tab auto-refreshes via its own component
      })
      // Dispute changes
      .on("postgres_changes", { event: "*", schema: "public", table: "disputes" }, () => {
        // Disputes tab auto-refreshes via its own component
      })
      // Agent changes → refresh agents list + stats
      .on("postgres_changes", { event: "*", schema: "public", table: "agents" }, () => {
        fetchAllAgents(100).then(ag => setAgents(ag));
        fetchAdminStats().then(s => setStats(prev => ({ ...s, pendingKyc: prev.pendingKyc })));
      })
      // Merchant changes → refresh merchants list + stats
      .on("postgres_changes", { event: "*", schema: "public", table: "merchants" }, () => {
        fetchAllMerchants(100).then(m => setMerchants(m));
        fetchAdminStats().then(s => setStats(prev => ({ ...s, pendingKyc: prev.pendingKyc })));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, loadData]);

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

  const navContent = (
    <nav className="flex flex-col gap-0.5 px-2 pb-4">
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          onClick={() => { setActiveTab(item.id); setShowNavMenu(false); }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === item.id
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <item.icon className="w-4 h-4 shrink-0" />
          {item.label}
          {item.id === "alerts" && stats.openAlerts > 0 && (
            <span className="ml-auto min-w-[16px] h-4 px-1 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full inline-flex items-center justify-center">
              {stats.openAlerts}
            </span>
          )}
          {item.id === "support" && supportUnread > 0 && (
            <span className="ml-auto min-w-[16px] h-4 px-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-full inline-flex items-center justify-center">
              {supportUnread}
            </span>
          )}
          {item.id === "kyc" && stats.pendingKyc > 0 && (
            <span className="ml-auto min-w-[16px] h-4 px-1 bg-orange-500 text-white text-[9px] font-bold rounded-full inline-flex items-center justify-center">
              {stats.pendingKyc}
            </span>
          )}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* ═══ Persistent sidebar – desktop only ═══ */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-56 bg-card border-r border-border z-40">
        <div className="px-4 py-4 flex items-center gap-2.5 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0 h-8 w-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <ShieldAlert className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <h1 className="font-bold text-foreground text-sm">Admin</h1>
        </div>
        <div className="flex-1 overflow-y-auto pt-2">
          {navContent}
        </div>
        <div className="px-3 pb-3">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={() => signOut()}>
            <LogOut className="w-4 h-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* ═══ Main column ═══ */}
      <div className="flex-1 flex flex-col md:ml-56">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-card border-b border-border">
          <div className="flex items-center justify-between px-4 md:px-6 py-3">
            <div className="flex items-center gap-2">
              {/* Mobile only: back + hamburger */}
              <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0 md:hidden">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2.5 md:hidden">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4 text-primary-foreground" />
                </div>
                <h1 className="font-bold text-foreground text-base">Admin</h1>
              </div>
              {/* Desktop: section label */}
              <span className="hidden md:block text-base font-bold text-foreground">
                {NAV_ITEMS.find(i => i.id === activeTab)?.label ?? "Overview"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search users, transactions…"
                  className="pl-10 w-64"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" onClick={loadData} disabled={refreshing}>
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Mobile: Active section label + hamburger */}
          <div className="flex md:hidden items-center gap-2 px-4 pb-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg shrink-0"
              onClick={() => setShowNavMenu(true)}
            >
              <Menu className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold text-foreground">
              {NAV_ITEMS.find(i => i.id === activeTab)?.label ?? "Overview"}
            </span>
          </div>
        </header>

        {/* Mobile slide-out navigation drawer */}
        <Sheet open={showNavMenu} onOpenChange={setShowNavMenu}>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="px-4 pt-4 pb-2">
              <SheetTitle className="text-sm font-bold">Navigation</SheetTitle>
            </SheetHeader>
            {navContent}
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-8 overflow-auto">

        {/* ═══ OVERVIEW ═══ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard icon={Users} label="Total Users" value={stats.totalUsers} color="bg-primary" />
              <StatCard icon={ArrowLeftRight} label="Transactions" value={stats.totalTransactions} color="bg-blue-500" />
              <StatCard icon={UserCheck} label="Agents" value={stats.totalAgents} color="bg-emerald-500" />
              <StatCard icon={Store} label="Merchants" value={stats.totalMerchants} color="bg-purple-500" />
              <StatCard icon={ShieldAlert} label="Open Alerts" value={stats.openAlerts} color="bg-destructive" />
              <StatCard icon={ScanFace} label="Pending KYC" value={stats.pendingKyc} color="bg-orange-500" />
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
                              <Button
                                size="sm"
                                variant="destructive"
                                className="text-xs h-7 gap-1"
                                onClick={() => setChargebackTarget({
                                  userId: user.user_id,
                                  name: user.name || null,
                                  phone: user.phone,
                                  balance: parseFloat(user.balance) || 0,
                                })}
                              >
                                <RotateCcw className="w-3 h-3" /> Chargeback
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
        {activeTab === "transactions" && <AdminActivityMonitor />}

        {/* ═══ CHARGEBACK HISTORY ═══ */}
        {activeTab === "chargebacks" && <AdminChargebackHistory />}

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

        {/* ═══ ORDER MANAGEMENT ═══ */}
        {activeTab === "orders" && <AdminOrderManagement />}

        {/* ═══ PAYMENT GATEWAYS ═══ */}
        {activeTab === "gateways" && <AdminGatewayConfig />}

        {/* ═══ GLOBAL FEATURE TOGGLES ═══ */}
        {activeTab === "toggles" && <AdminGlobalToggles />}

        {/* ═══ RECHARGE PACK MANAGER ═══ */}
        {activeTab === "recharge" && <RechargeSection />}

        {/* ═══ KYC REVIEW ═══ */}
        {activeTab === "kyc" && <AdminKycReview />}

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

      {/* Admin Chargeback Dialog */}
      <AdminChargebackDialog
        target={chargebackTarget}
        open={!!chargebackTarget}
        onOpenChange={(v) => { if (!v) setChargebackTarget(null); }}
        onSuccess={loadData}
      />
      </div>
    </div>
  );
}

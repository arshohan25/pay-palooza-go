import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Users, ArrowLeftRight, ShieldAlert, Store, UserCheck, Trash2, Download, UserX, CheckCircle, Clock, Eye,
  TrendingUp, Activity, Search, RefreshCw, LogOut,
  LayoutDashboard, UserCog, Receipt, AlertTriangle, Settings, FileText,
  ChevronLeft, Coins, Scale, BarChart3, MessageCircle, Lock, RotateCcw, Package, CreditCard, ToggleRight, Smartphone,
  Menu, ScanFace, Gift, Award, Wallet, Radio, Plug, ShieldCheck, Image, Bell, PiggyBank, Shield, Star, Building2, Megaphone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useRealtimeStatus } from "@/hooks/use-realtime-status";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAdmin, fetchAdminStats, fetchRecentTransactions, fetchAllUsers, fetchFraudAlerts, fetchAllAgents, fetchAllMerchants, toggleUserStatus, toggleAgentStatus, toggleMerchantStatus, softDeleteUser, reactivateUser, bulkSuspendUsers, bulkDeleteUsers, bulkSoftDeleteUsers, exportUsersCSV, fetchUserDetails, fetchDeletedUsers, fetchDeletedUserDetail } from "@/hooks/use-admin";
import { Checkbox } from "@/components/ui/checkbox";
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
import AdminReferralManagement from "@/components/admin/AdminReferralManagement";
import AdminPermissions from "@/components/admin/AdminPermissions";
import AdminTreasury from "@/components/admin/AdminTreasury";
import AdminWebhookLog from "@/components/admin/AdminWebhookLog";
import AdminActivityFeed from "@/components/admin/AdminActivityFeed";
import AdminApiHub from "@/components/admin/AdminApiHub";
import AdminBillerConfig from "@/components/admin/AdminBillerConfig";
import AdminAuditLogViewer from "@/components/admin/AdminAuditLogViewer";
import AdminBannerManager from "@/components/admin/AdminBannerManager";
import AdminLimitManager from "@/components/admin/AdminLimitManager";
import AdminTeamManagement from "@/components/admin/AdminTeamManagement";
import AdminNotificationSender from "@/components/admin/AdminNotificationSender";
import TeamOnboardingChecklist from "@/components/admin/TeamOnboardingChecklist";
import AdminMerchantManagement from "@/components/admin/AdminMerchantManagement";
import AdminSavingsManagement from "@/components/admin/AdminSavingsManagement";
import AdminFundRequests from "@/components/admin/AdminFundRequests";
import AdminSettlements from "@/components/admin/AdminSettlements";
import AdminBankReconciliation from "@/components/admin/AdminBankReconciliation";
import AdminMarketingTools from "@/components/admin/AdminMarketingTools";
import AdminAdvancedReports from "@/components/admin/AdminAdvancedReports";
import AdminAgentHub from "@/components/admin/AdminAgentHub";
import AdminWalletSystem from "@/components/admin/AdminWalletSystem";
import AdminSecurityCenter from "@/components/admin/AdminSecurityCenter";
import AdminSystemSettings from "@/components/admin/AdminSystemSettings";
import AdminLoyaltyPoints from "@/components/admin/AdminLoyaltyPoints";
import AdminAiFraudDetection from "@/components/admin/AdminAiFraudDetection";
import AdminGeoTracking from "@/components/admin/AdminGeoTracking";
import AdminSmartRouting from "@/components/admin/AdminSmartRouting";
import AdminLiquidityPrediction from "@/components/admin/AdminLiquidityPrediction";
import AdminRealtimeMonitor from "@/components/admin/AdminRealtimeMonitor";
import AdminDepositAccounts from "@/components/admin/AdminDepositAccounts";
import AdminRiskControl from "@/components/admin/AdminRiskControl";
import AdminFloatManagement from "@/components/admin/AdminFloatManagement";
import AdminRevenueDashboard from "@/components/admin/AdminRevenueDashboard";
import AdminMfsMonitor from "@/components/admin/AdminMfsMonitor";
import AdminMerchantApplications from "@/components/admin/AdminMerchantApplications";
import AdminApiRequests from "@/components/admin/AdminApiRequests";
import TeamActivityDashboard from "@/components/admin/TeamActivityDashboard";
import AdminDistributorManagement from "@/components/admin/AdminDistributorManagement";
import AdminSystemHealth from "@/components/admin/AdminSystemHealth";
import AdminDataExport from "@/components/admin/AdminDataExport";
import AdminUserSessions from "@/components/admin/AdminUserSessions";
import AdminComplaintManager from "@/components/admin/AdminComplaintManager";
import AdminDeviceManager from "@/components/admin/AdminDeviceManager";
import AdminAutoSaveMonitor from "@/components/admin/AdminAutoSaveMonitor";
import AdminOtpMonitor from "@/components/admin/AdminOtpMonitor";
import AdminCommissionLedger from "@/components/admin/AdminCommissionLedger";
import AdminAnnouncementManager from "@/components/admin/AdminAnnouncementManager";
import { useSupportNotifications } from "@/hooks/use-support-notifications";
import { useRealtimeIndicator } from "@/hooks/use-realtime-indicator";
import RealtimeUpdateIndicator from "@/components/admin/RealtimeUpdateIndicator";
import { useIsMobile } from "@/hooks/use-mobile";

interface Stats {
  totalUsers: number;
  totalTransactions: number;
  totalAgents: number;
  totalMerchants: number;
  openAlerts: number;
  pendingKyc: number;
  totalReferrals: number;
  totalRewardsPaid: number;
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


const StatCard = ({ icon: Icon, label, value, color, onClick }: { icon: any; label: string; value: number | string; color: string; onClick?: () => void }) => (
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
    <Card
      className={`border-0 shadow-[var(--shadow-card)] transition-colors ${onClick ? "cursor-pointer hover:bg-muted/40" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="w-5 h-5 md:w-6 md:h-6 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-xs md:text-sm text-muted-foreground truncate">{label}</p>
          <p className="text-xl md:text-2xl font-bold text-foreground truncate">{typeof value === "number" ? value.toLocaleString() : value}</p>
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

const NAV_GROUPS: { label: string; pro?: boolean; items: { id: string; label: string; icon: any }[] }[] = [
  {
    label: "Overview",
    items: [
      { id: "overview", label: "Dashboard", icon: LayoutDashboard },
      { id: "users", label: "Users", icon: UserCog },
      { id: "alerts", label: "Fraud Alerts", icon: AlertTriangle },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "transactions", label: "Transactions", icon: Receipt },
      { id: "chargebacks", label: "Chargebacks", icon: RotateCcw },
      { id: "mfs_monitor", label: "MFS Monitor", icon: Activity },
      { id: "disputes", label: "Disputes", icon: Scale },
      { id: "support", label: "Support", icon: MessageCircle },
      { id: "complaints", label: "Complaints", icon: AlertTriangle },
      { id: "kyc", label: "KYC", icon: ScanFace },
      { id: "orders", label: "Orders", icon: Package },
      { id: "fund_requests", label: "Fund Requests", icon: CreditCard },
      { id: "merchant_apps", label: "Merchant Apps", icon: Store },
      { id: "api_requests", label: "API Requests", icon: Plug },
    ],
  },
  {
    label: "Financial",
    items: [
      { id: "commissions", label: "Commissions", icon: Coins },
      { id: "charges", label: "Charges", icon: Settings },
      { id: "settlements", label: "Settlements", icon: Wallet },
      { id: "bank_recon", label: "Bank Recon", icon: CreditCard },
      { id: "treasury", label: "Treasury", icon: Wallet },
      { id: "float_mgmt", label: "Float Mgmt", icon: Wallet },
      { id: "revenue", label: "Revenue", icon: TrendingUp },
      { id: "savings", label: "Savings", icon: PiggyBank },
      { id: "auto_save", label: "Auto-Save", icon: PiggyBank },
      { id: "deposit_accounts", label: "Deposit Accts", icon: CreditCard },
      { id: "commission_ledger", label: "Commission Log", icon: Coins },
      { id: "limits", label: "Limits", icon: Scale },
    ],
  },
  {
    label: "Network",
    items: [
      { id: "agent_hub", label: "Agent Hub", icon: Building2 },
      { id: "wallets", label: "Wallets", icon: Wallet },
      { id: "merchants", label: "Merchants", icon: Store },
      { id: "referrals", label: "Referrals", icon: Gift },
      { id: "distributors", label: "Distributors", icon: Building2 },
    ],
  },
  {
    label: "System",
    items: [
      { id: "gateways", label: "Gateways", icon: CreditCard },
      { id: "toggles", label: "Toggles", icon: ToggleRight },
      { id: "locks", label: "Locks", icon: Lock },
      { id: "permissions", label: "Permissions", icon: ShieldAlert },
      { id: "security", label: "Security", icon: Shield },
      { id: "sys_settings", label: "Settings", icon: Settings },
      { id: "apihub", label: "API Hub", icon: Plug },
      { id: "webhooks", label: "Webhooks", icon: Activity },
      { id: "billers", label: "Billers", icon: FileText },
      { id: "recharge", label: "Recharge", icon: Smartphone },
      { id: "risk_control", label: "Risk Control", icon: ShieldAlert },
      { id: "devices", label: "Devices", icon: Smartphone },
      { id: "otp_monitor", label: "OTP Monitor", icon: ShieldAlert },
      { id: "sys_health", label: "Health", icon: Activity },
      { id: "sessions", label: "Sessions", icon: Users },
    ],
  },
  {
    label: "Marketing",
    items: [
      { id: "marketing", label: "Marketing", icon: Gift },
      { id: "banners", label: "Banners", icon: Image },
      { id: "loyalty", label: "Loyalty", icon: Star },
      { id: "notify", label: "Notify", icon: Bell },
      { id: "announcements", label: "Announcements", icon: Megaphone },
    ],
  },
  {
    label: "Reports",
    items: [
      { id: "reporting", label: "Reports", icon: BarChart3 },
      { id: "adv_reports", label: "Adv. Reports", icon: BarChart3 },
      { id: "auditlog", label: "Audit Log", icon: Eye },
      { id: "data_export", label: "Export", icon: Download },
    ],
  },
  {
    label: "⭐ Pro Fintech",
    pro: true,
    items: [
      { id: "ai_fraud", label: "AI Fraud", icon: ShieldCheck },
      { id: "geo_tracking", label: "Geo Track", icon: Building2 },
      { id: "smart_routing", label: "Routing", icon: CreditCard },
      { id: "liquidity", label: "Liquidity", icon: TrendingUp },
      { id: "live_monitor", label: "Live Monitor", icon: Activity },
    ],
  },
  {
    label: "Other",
    items: [
      { id: "team", label: "Team", icon: Users },
      { id: "team_activity", label: "Team Activity", icon: Activity },
      { id: "trash", label: "Trash", icon: Trash2 },
    ],
  },
];

const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items) as { id: string; label: string; icon: any }[];

export default function AdminDashboard() {
  const { isAdmin, loading: authLoading } = useAdmin();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [showActivityFeed, setShowActivityFeed] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const { unreadCount: supportUnread } = useSupportNotifications(activeTab);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalTransactions: 0, totalAgents: 0, totalMerchants: 0, openAlerts: 0, pendingKyc: 0, totalReferrals: 0, totalRewardsPaid: 0 });
  const [pendingFundCount, setPendingFundCount] = useState(0);
  const [pendingFundAmount, setPendingFundAmount] = useState(0);
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
  const [deleteTarget, setDeleteTarget] = useState<{ userId: string; name: string; phone: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [softDeleteTarget, setSoftDeleteTarget] = useState<{ userId: string; name: string; phone: string } | null>(null);
  const [softDeleting, setSoftDeleting] = useState(false);
  const [detailUser, setDetailUser] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<{ profile: any; roles: any[]; kyc: any; transactions: any[]; limitOverrides: any[]; globalLimits: any[] } | null>(null);
  const [editingLimit, setEditingLimit] = useState<{
    txnType: string; period: string; oldAmount: number; oldCount: number; newAmount: string; newCount: string; isCustom: boolean; overrideId: string | null;
  } | null>(null);
  const [savingLimit, setSavingLimit] = useState(false);
  const [detailUsage, setDetailUsage] = useState<{ daily: Record<string, { usedAmount: number; usedCount: number }>; monthly: Record<string, { usedAmount: number; usedCount: number }> } | null>(null);
  const { visible: realtimeVisible, flash: realtimeFlash } = useRealtimeIndicator();
  const { status: wsStatus, lastConnectedAt, reconnectAttempt } = useRealtimeStatus();
  const [disabledTogglesCount, setDisabledTogglesCount] = useState(0);
  const [resetPinTarget, setResetPinTarget] = useState<{ userId: string; name: string; phone: string } | null>(null);
  const [deletedUsers, setDeletedUsers] = useState<any[]>([]);
  const [trashDetailId, setTrashDetailId] = useState<string | null>(null);
  const [trashDetail, setTrashDetail] = useState<any>(null);
  const [trashDetailLoading, setTrashDetailLoading] = useState(false);
  const [tempPin, setTempPin] = useState("");
  const [resettingPin, setResettingPin] = useState(false);

  const generateTempPin = () => {
    const digits = "0123456789";
    let pin = "";
    for (let i = 0; i < 4; i++) pin += digits[Math.floor(Math.random() * 10)];
    return pin;
  };

  const handleResetPin = async () => {
    if (!resetPinTarget || !tempPin) return;
    setResettingPin(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("admin-reset-pin", {
        body: { targetUserId: resetPinTarget.userId, tempPin },
      });
      if (res.error) throw new Error(res.error.message || "Failed to reset PIN");
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(`PIN reset to ${tempPin} for ${resetPinTarget.name || resetPinTarget.phone}`, { duration: 10000 });
      setResetPinTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to reset PIN");
    } finally {
      setResettingPin(false);
    }
  };

  // Load deleted users when trash tab is active
  useEffect(() => {
    if (activeTab === "trash" && isAdmin) {
      fetchDeletedUsers().then(setDeletedUsers);
    }
  }, [activeTab, isAdmin]);

  const openTrashDetail = async (id: string) => {
    setTrashDetailId(id);
    setTrashDetailLoading(true);
    try {
      const detail = await fetchDeletedUserDetail(id);
      setTrashDetail(detail);
    } catch {
      setTrashDetail(null);
    } finally {
      setTrashDetailLoading(false);
    }
  };


  // Fetch disabled toggles count
  useEffect(() => {
    if (!isAdmin) return;
    const fetchCount = async () => {
      const { count } = await supabase.from("global_feature_toggles").select("id", { count: "exact", head: true }).eq("is_enabled", false);
      setDisabledTogglesCount(count ?? 0);
    };
    fetchCount();
    const ch = supabase.channel("admin-toggle-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "global_feature_toggles" }, () => fetchCount())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);

  const fetchUserUsage = async (userId: string) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const { data } = await supabase.from("transactions")
      .select("type, amount, created_at")
      .eq("user_id", userId).eq("status", "completed")
      .gte("created_at", monthStart.toISOString());
    const TXN_KEYS = ["send", "cashin", "cashout", "addmoney", "payment", "recharge", "paybill", "banktransfer"];
    const empty = () => Object.fromEntries(TXN_KEYS.map(k => [k, { usedAmount: 0, usedCount: 0 }]));
    const d = empty(), m = empty();
    for (const txn of data ?? []) {
      const key = txn.type as string;
      if (!TXN_KEYS.includes(key)) continue;
      const amt = Number(txn.amount);
      m[key].usedAmount += amt; m[key].usedCount += 1;
      if (new Date(txn.created_at) >= todayStart) { d[key].usedAmount += amt; d[key].usedCount += 1; }
    }
    return { daily: d, monthly: m };
  };

  const openUserDetail = async (user: any) => {
    setDetailUser(user);
    setDetailLoading(true);
    setDetailUsage(null);
    try {
      const [data, usage] = await Promise.all([fetchUserDetails(user.user_id), fetchUserUsage(user.user_id)]);
      setDetailData(data);
      setDetailUsage(usage);
    } catch {
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchPendingFunds = useCallback(async () => {
    const { count, data } = await supabase
      .from("fund_requests")
      .select("amount", { count: "exact" })
      .eq("status", "pending");
    setPendingFundCount(count ?? 0);
    setPendingFundAmount((data ?? []).reduce((sum, r) => sum + Number(r.amount), 0));
  }, []);

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
    fetchPendingFunds();
    setRefreshing(false);
  }, [fetchPendingFunds]);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/");
      return;
    }
    if (isAdmin) loadData();
  }, [isAdmin, authLoading, navigate, loadData]);

  // Track admin login + update last_active_at
  const loginTrackedRef = useRef(false);
  useEffect(() => {
    if (!isAdmin || loginTrackedRef.current) return;
    loginTrackedRef.current = true;
    const trackLogin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      // Upsert last_active_at
      await supabase.from("team_members")
        .update({ last_active_at: new Date().toISOString() } as any)
        .eq("user_id", session.user.id);
      // Record admin_login (deduplicated per session via ref)
      await supabase.from("audit_logs").insert({
        actor_id: session.user.id,
        action: "admin_login",
        entity_type: "session",
        entity_id: session.user.id,
        details: { timestamp: new Date().toISOString() },
      });
    };
    trackLogin();
  }, [isAdmin]);

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
        realtimeFlash();
      })
      // Fraud alert status changes
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "fraud_alerts" }, () => {
        fetchAdminStats().then(s => setStats(prev => ({ ...s, pendingKyc: prev.pendingKyc })));
        realtimeFlash();
      })
      // New transactions → refresh overview stats + transaction list
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, () => {
        loadData();
        realtimeFlash();
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
      // KYC changes → refresh pending KYC count
      .on("postgres_changes", { event: "*", schema: "public", table: "kyc_verifications" }, () => {
        supabase.from("kyc_verifications").select("id", { count: "exact", head: true }).eq("status", "pending")
          .then(({ count }) => setStats(prev => ({ ...prev, pendingKyc: count ?? 0 })));
      })
      // Order changes → refresh stats
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        // Orders tab has its own state; just keep stats fresh
        loadData();
      })
      // Referral changes → refresh referral stats
      .on("postgres_changes", { event: "*", schema: "public", table: "referrals" }, () => {
        fetchAdminStats().then(s => setStats(prev => ({ ...s, pendingKyc: prev.pendingKyc })));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "referral_rewards" }, () => {
        fetchAdminStats().then(s => setStats(prev => ({ ...s, pendingKyc: prev.pendingKyc })));
      })
      // Treasury changes → refresh stats
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_treasury" }, () => {
        // Treasury tab manages its own state; stats refresh for consistency
        loadData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "treasury_ledger" }, () => {
        loadData();
      })
      // Support conversation changes → refresh stats
      .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations" }, () => {
        // Support tab has its own realtime; lightweight stats refresh
        loadData();
      })
      // Global toggles / gateways → child components manage own state
      .on("postgres_changes", { event: "*", schema: "public", table: "global_feature_toggles" }, () => {
        // Toggles tab auto-refreshes
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_gateways" }, () => {
        // Gateways tab auto-refreshes
      })
      // Fund request changes → refresh pending funds card
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_requests" }, () => {
        fetchPendingFunds();
        realtimeFlash();
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

  const handleDeleteUser = async (force = false) => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ target_user_id: deleteTarget.userId, force }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to delete user");
      toast.success(`User ${deleteTarget.name || deleteTarget.phone} permanently deleted`);
      setUsers(prev => prev.filter(u => u.user_id !== deleteTarget.userId));
      setSelectedUserIds(prev => { const n = new Set(prev); n.delete(deleteTarget.userId); return n; });
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!softDeleteTarget) return;
    setSoftDeleting(true);
    try {
      await softDeleteUser(softDeleteTarget.userId);
      toast.success(`User ${softDeleteTarget.name || softDeleteTarget.phone} deactivated (30-day grace period)`);
      setSoftDeleteTarget(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to deactivate user");
    } finally {
      setSoftDeleting(false);
    }
  };

  const handleReactivate = async (userId: string, label: string) => {
    try {
      await reactivateUser(userId);
      toast.success(`User ${label} reactivated`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to reactivate");
    }
  };

  const handleBulkSuspend = async () => {
    setBulkActionLoading(true);
    const statuses: Record<string, string> = {};
    users.forEach(u => { if (selectedUserIds.has(u.user_id)) statuses[u.user_id] = u.status || "active"; });
    const { succeeded, failed } = await bulkSuspendUsers([...selectedUserIds], statuses);
    toast.success(`Toggled ${succeeded} users${failed ? `, ${failed} failed` : ""}`);
    setSelectedUserIds(new Set());
    setBulkActionLoading(false);
    loadData();
  };

  const handleBulkSoftDelete = async () => {
    setBulkActionLoading(true);
    const { succeeded, failed } = await bulkSoftDeleteUsers([...selectedUserIds]);
    toast.success(`Deactivated ${succeeded} users${failed ? `, ${failed} failed` : ""}`);
    setSelectedUserIds(new Set());
    setBulkActionLoading(false);
    loadData();
  };

  const handleBulkHardDelete = async () => {
    setBulkActionLoading(true);
    const { succeeded, failed } = await bulkDeleteUsers([...selectedUserIds], true);
    toast.success(`Deleted ${succeeded} users${failed ? `, ${failed} failed` : ""}`);
    setSelectedUserIds(new Set());
    setBulkActionLoading(false);
    loadData();
  };

  const handleExportSelected = () => {
    const selected = users.filter(u => selectedUserIds.has(u.user_id));
    if (selected.length === 0) { toast.error("No users selected"); return; }
    exportUsersCSV(selected);
    toast.success(`Exported ${selected.length} users to CSV`);
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds(prev => {
      const n = new Set(prev);
      if (n.has(userId)) n.delete(userId); else n.add(userId);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map(u => u.user_id)));
    }
  };

  const getGracePeriodDays = (scheduledAt: string | null) => {
    if (!scheduledAt) return null;
    const days = Math.ceil((new Date(scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const navContent = (
    <nav className="flex flex-col gap-1 px-2 pb-4">
      {NAV_GROUPS.map((group, gi) => (
        <div key={group.label}>
          {gi > 0 && <Separator className="my-2" />}
          <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
            group.pro ? "text-primary" : "text-muted-foreground/60"
          }`}>
            {group.label}
          </div>
          <div className="flex flex-col gap-0.5">
            {group.items.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setShowNavMenu(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
                  <span className="ml-auto min-w-[16px] h-4 px-1 bg-amber-500 text-amber-50 text-[9px] font-bold rounded-full inline-flex items-center justify-center">
                    {stats.pendingKyc}
                  </span>
                )}
                {item.id === "toggles" && disabledTogglesCount > 0 && (
                  <span className="ml-auto min-w-[16px] h-4 px-1 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full inline-flex items-center justify-center">
                    {disabledTogglesCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
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
      <div className={`flex-1 flex flex-col md:ml-56 overflow-x-hidden transition-[margin] duration-300 ${showActivityFeed && !isMobile ? "md:mr-72" : ""}`}>
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
              <div className="relative md:hidden flex-1 max-w-[160px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search…"
                  className="pl-8 h-8 text-xs"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-default ${
                      wsStatus === "connected"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : wsStatus === "connecting"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-destructive/10 text-destructive"
                    }`}>
                      <span className="relative flex h-2 w-2">
                        {wsStatus === "connected" && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                        )}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${
                          wsStatus === "connected" ? "bg-emerald-500" : wsStatus === "connecting" ? "bg-amber-500" : "bg-destructive"
                        }`} />
                      </span>
                      {wsStatus === "connected" ? "Live" : wsStatus === "connecting" ? "Connecting…" : "Offline"}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs space-y-1">
                    <p><span className="text-muted-foreground">Channel:</span> admin-heartbeat</p>
                    <p><span className="text-muted-foreground">Last connected:</span> {lastConnectedAt ? lastConnectedAt.toLocaleTimeString() : "Never"}</p>
                    {wsStatus !== "connected" && reconnectAttempt > 0 && (
                      <p><span className="text-muted-foreground">Reconnect attempt:</span> {reconnectAttempt}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button variant="outline" size="icon" onClick={loadData} disabled={refreshing} className="h-7 w-7 md:h-9 md:w-9">
                <RefreshCw className={`w-3.5 h-3.5 md:w-4 md:h-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant={showActivityFeed ? "default" : "outline"}
                size="icon"
                onClick={() => setShowActivityFeed(v => !v)}
                title="Activity Feed"
                className="h-7 w-7 md:h-9 md:w-9"
              >
                <Radio className="w-3.5 h-3.5 md:w-4 md:h-4" />
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
          <SheetContent side="left" className="w-64 p-0 flex flex-col">
            <SheetHeader className="px-4 pt-4 pb-2 shrink-0">
              <SheetTitle className="text-sm font-bold">Navigation</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              {navContent}
            </div>
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <main className="flex-1 px-2 py-4 sm:px-4 md:p-8 overflow-auto min-h-0 pb-8">
          <RealtimeUpdateIndicator visible={realtimeVisible} />

        {/* ═══ OVERVIEW ═══ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <TeamOnboardingChecklist />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Total Users" value={stats.totalUsers} color="bg-primary" onClick={() => setActiveTab("users")} />
              <StatCard icon={ArrowLeftRight} label="Transactions" value={stats.totalTransactions} color="bg-blue-500" onClick={() => setActiveTab("transactions")} />
              <StatCard icon={UserCheck} label="Agents" value={stats.totalAgents} color="bg-emerald-500" onClick={() => setActiveTab("users")} />
              <StatCard icon={Store} label="Merchants" value={stats.totalMerchants} color="bg-purple-500" onClick={() => setActiveTab("merchants")} />
              <StatCard icon={ShieldAlert} label="Open Alerts" value={stats.openAlerts} color="bg-destructive" onClick={() => setActiveTab("alerts")} />
              <StatCard icon={ScanFace} label="Pending KYC" value={stats.pendingKyc} color="bg-orange-500" onClick={() => setActiveTab("kyc")} />
              <StatCard icon={Gift} label="Referrals" value={stats.totalReferrals} color="bg-teal-500" onClick={() => setActiveTab("referrals")} />
              <StatCard icon={Award} label="Rewards Paid" value={`৳${stats.totalRewardsPaid.toLocaleString()}`} color="bg-amber-500" onClick={() => setActiveTab("referrals")} />
              <StatCard icon={Wallet} label="Pending Funds" value={pendingFundCount > 0 ? `${pendingFundCount} / ৳${pendingFundAmount.toLocaleString()}` : "0"} color="bg-rose-500" onClick={() => setActiveTab("fund_requests")} />
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
                        <th className="text-left px-3 md:px-4 py-3 font-medium">Type</th>
                        <th className="text-left px-3 md:px-4 py-3 font-medium">Amount</th>
                        <th className="text-left px-3 md:px-4 py-3 font-medium hidden md:table-cell">Recipient</th>
                        <th className="text-left px-3 md:px-4 py-3 font-medium hidden lg:table-cell">Status</th>
                        <th className="text-left px-3 md:px-4 py-3 font-medium">Time</th>
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
                  <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                      <FileText className="w-7 h-7 text-muted-foreground" />
                    </motion.div>
                    <p className="text-sm font-semibold text-foreground">No transactions yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Transactions will appear here</p>
                  </motion.div>
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

                {/* Bulk actions toolbar */}
                {selectedUserIds.size > 0 && (
                  <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{selectedUserIds.size} selected</span>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleBulkSuspend} disabled={bulkActionLoading}>
                      Bulk Suspend
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={handleBulkSoftDelete} disabled={bulkActionLoading}>
                      <UserX className="w-3 h-3" /> Bulk Deactivate
                    </Button>
                    <Button size="sm" variant="destructive" className="text-xs h-7 gap-1" onClick={handleBulkHardDelete} disabled={bulkActionLoading}>
                      <Trash2 className="w-3 h-3" /> Bulk Delete
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={handleExportSelected}>
                      <Download className="w-3 h-3" /> Export CSV
                    </Button>
                  </div>
                )}

                <CardContent className="p-0">
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="px-4 py-3 w-8">
                            <Checkbox
                              checked={filteredUsers.length > 0 && selectedUserIds.size === filteredUsers.length}
                              onCheckedChange={toggleSelectAll}
                            />
                          </th>
                          <th className="text-left px-4 py-3 font-medium">Name</th>
                          <th className="text-left px-4 py-3 font-medium">Phone</th>
                          <th className="text-left px-4 py-3 font-medium">Balance</th>
                          <th className="text-left px-4 py-3 font-medium">Status</th>
                          <th className="text-left px-4 py-3 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((user: any) => {
                          const isDeactivated = user.status === "deactivated";
                          const graceDays = getGracePeriodDays(user.scheduled_deletion_at);
                          return (
                            <tr key={user.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3">
                                <Checkbox
                                  checked={selectedUserIds.has(user.user_id)}
                                  onCheckedChange={() => toggleSelectUser(user.user_id)}
                                />
                              </td>
                              <td className="px-4 py-3 font-medium text-foreground">{user.name || "—"}</td>
                              <td className="px-4 py-3 text-muted-foreground">{user.phone}</td>
                              <td className="px-4 py-3 font-semibold text-foreground">৳{parseFloat(user.balance).toLocaleString()}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <Badge
                                    variant={user.status === "suspended" ? "destructive" : isDeactivated ? "outline" : "secondary"}
                                    className={`text-xs ${isDeactivated ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300 dark:border-orange-700" : ""}`}
                                  >
                                    {user.status || "active"}
                                  </Badge>
                                  {isDeactivated && graceDays !== null && (
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                      <Clock className="w-3 h-3" /> {graceDays}d
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => openUserDetail(user)}>
                                    <Eye className="w-3 h-3" /> View
                                  </Button>
                                  {isDeactivated ? (
                                    <>
                                      <Button size="sm" variant="default" className="text-xs h-7 gap-1" onClick={() => handleReactivate(user.user_id, user.name || user.phone)}>
                                        <CheckCircle className="w-3 h-3" /> Reactivate
                                      </Button>
                                      <Button size="sm" variant="destructive" className="text-xs h-7 gap-1" onClick={() => setDeleteTarget({ userId: user.user_id, name: user.name || "", phone: user.phone })}>
                                        <Trash2 className="w-3 h-3" /> Delete Now
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button size="sm" variant={user.status === "suspended" ? "default" : "destructive"} className="text-xs h-7" onClick={async () => { try { const ns = await toggleUserStatus(user.user_id, user.status || "active"); setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: ns } : u)); toast.success(`User ${ns}`); } catch { toast.error("Failed to update status"); } }}>
                                        {user.status === "suspended" ? "Activate" : "Suspend"}
                                      </Button>
                                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setSoftDeleteTarget({ userId: user.user_id, name: user.name || "", phone: user.phone })}>
                                        <UserX className="w-3 h-3" /> Deactivate
                                      </Button>
                                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setLockTarget({ userId: user.user_id, label: `${user.name || "User"} (${user.phone})` })}>
                                        <Lock className="w-3 h-3" /> Lock
                                      </Button>
                                      <Button size="sm" variant="destructive" className="text-xs h-7 gap-1" onClick={() => setChargebackTarget({ userId: user.user_id, name: user.name || null, phone: user.phone, balance: parseFloat(user.balance) || 0 })}>
                                        <RotateCcw className="w-3 h-3" /> Chargeback
                                      </Button>
                                      <Button size="sm" variant="destructive" className="text-xs h-7 gap-1" onClick={() => setDeleteTarget({ userId: user.user_id, name: user.name || "", phone: user.phone })}>
                                        <Trash2 className="w-3 h-3" /> Hard Delete
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile card layout */}
                  <div className="md:hidden divide-y divide-border/50">
                    {filteredUsers.map((user: any) => {
                      const isDeactivated = user.status === "deactivated";
                      const graceDays = getGracePeriodDays(user.scheduled_deletion_at);
                      return (
                        <div key={user.id} className="p-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedUserIds.has(user.user_id)}
                              onCheckedChange={() => toggleSelectUser(user.user_id)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold text-foreground text-sm truncate">{user.name || "—"}</p>
                                <Badge
                                  variant={user.status === "suspended" ? "destructive" : isDeactivated ? "outline" : "secondary"}
                                  className={`text-[10px] shrink-0 ${isDeactivated ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300 dark:border-orange-700" : ""}`}
                                >
                                  {user.status || "active"}
                                  {isDeactivated && graceDays !== null && ` · ${graceDays}d`}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{user.phone}</p>
                              <p className="text-sm font-semibold text-foreground mt-1">৳{parseFloat(user.balance).toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 pl-7">
                            <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => openUserDetail(user)}>
                              <Eye className="w-3 h-3" /> View
                            </Button>
                            {isDeactivated ? (
                              <>
                                <Button size="sm" variant="default" className="text-xs h-7 gap-1" onClick={() => handleReactivate(user.user_id, user.name || user.phone)}>
                                  <CheckCircle className="w-3 h-3" /> Reactivate
                                </Button>
                                <Button size="sm" variant="destructive" className="text-xs h-7 gap-1" onClick={() => setDeleteTarget({ userId: user.user_id, name: user.name || "", phone: user.phone })}>
                                  <Trash2 className="w-3 h-3" /> Delete
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" variant={user.status === "suspended" ? "default" : "destructive"} className="text-xs h-7" onClick={async () => { try { const ns = await toggleUserStatus(user.user_id, user.status || "active"); setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: ns } : u)); toast.success(`User ${ns}`); } catch { toast.error("Failed to update status"); } }}>
                                  {user.status === "suspended" ? "Activate" : "Suspend"}
                                </Button>
                                <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setSoftDeleteTarget({ userId: user.user_id, name: user.name || "", phone: user.phone })}>
                                  <UserX className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setLockTarget({ userId: user.user_id, label: `${user.name || "User"} (${user.phone})` })}>
                                  <Lock className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="destructive" className="text-xs h-7 gap-1" onClick={() => setDeleteTarget({ userId: user.user_id, name: user.name || "", phone: user.phone })}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {filteredUsers.length === 0 && (
                    <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
                      <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                        <Users className="w-7 h-7 text-muted-foreground" />
                      </motion.div>
                      <p className="text-sm font-semibold text-foreground">No users found</p>
                      <p className="text-xs text-muted-foreground mt-1">Users will appear here</p>
                    </motion.div>
                  )}
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
                  {agents.length === 0 && (
                    <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
                      <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                        <Users className="w-7 h-7 text-muted-foreground" />
                      </motion.div>
                      <p className="text-sm font-semibold text-foreground">No agents found</p>
                      <p className="text-xs text-muted-foreground mt-1">Agents will appear here</p>
                    </motion.div>
                  )}
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
                  {merchants.length === 0 && (
                    <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
                      <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                        <Store className="w-7 h-7 text-muted-foreground" />
                      </motion.div>
                      <p className="text-sm font-semibold text-foreground">No merchants found</p>
                      <p className="text-xs text-muted-foreground mt-1">Merchants will appear here</p>
                    </motion.div>
                  )}
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

        {/* ═══ REFERRAL MANAGEMENT ═══ */}
        {activeTab === "referrals" && <AdminReferralManagement />}

        {/* ═══ PERMISSIONS DASHBOARD ═══ */}
        {activeTab === "permissions" && <AdminPermissions />}

        {/* ═══ TREASURY DASHBOARD ═══ */}
        {activeTab === "treasury" && <AdminTreasury />}

        {/* ═══ FUND REQUESTS ═══ */}
        {activeTab === "fund_requests" && (
          <div className="space-y-8">
            <AdminFundRequests />
            <Separator />
            <AdminDepositAccounts />
          </div>
        )}

        {/* ═══ WEBHOOK LOG ═══ */}
        {activeTab === "webhooks" && <AdminWebhookLog />}

        {/* ═══ REPORTING DASHBOARD ═══ */}
        {activeTab === "reporting" && <AdminReporting />}

        {/* ═══ API HUB ═══ */}
        {activeTab === "apihub" && <AdminApiHub onNavigate={setActiveTab} />}

        {/* ═══ BILLER API CONFIGS ═══ */}
        {activeTab === "billers" && <AdminBillerConfig />}

        {/* ═══ AUDIT LOG VIEWER ═══ */}
        {activeTab === "auditlog" && <AdminAuditLogViewer />}

        {/* ═══ BANNER MANAGEMENT ═══ */}
        {activeTab === "banners" && <AdminBannerManager />}

        {/* ═══ LIMIT MANAGEMENT ═══ */}
        {activeTab === "limits" && <AdminLimitManager />}

        {/* ═══ MERCHANT MANAGEMENT ═══ */}
        {activeTab === "merchants" && <AdminMerchantManagement />}

        {/* ═══ TEAM MANAGEMENT ═══ */}
        {activeTab === "team" && <AdminTeamManagement />}

        {/* ═══ NOTIFICATIONS ═══ */}
        {activeTab === "notify" && <AdminNotificationSender />}

        {/* ═══ ANNOUNCEMENTS ═══ */}
        {activeTab === "announcements" && <AdminAnnouncementManager />}

        {/* ═══ SAVINGS ═══ */}
        {activeTab === "savings" && <AdminSavingsManagement />}

        {/* ═══ SETTLEMENTS ═══ */}
        {activeTab === "settlements" && <AdminSettlements />}

        {/* ═══ BANK RECONCILIATION ═══ */}
        {activeTab === "bank_recon" && <AdminBankReconciliation />}

        {/* ═══ MARKETING TOOLS ═══ */}
        {activeTab === "marketing" && <AdminMarketingTools />}

        {/* ═══ ADVANCED REPORTS ═══ */}
        {activeTab === "adv_reports" && <AdminAdvancedReports />}

        {/* ═══ AGENT HUB ═══ */}
        {activeTab === "agent_hub" && <AdminAgentHub />}

        {/* ═══ WALLET SYSTEM ═══ */}
        {activeTab === "wallets" && <AdminWalletSystem />}

        {/* ═══ SECURITY CENTER ═══ */}
        {activeTab === "security" && <AdminSecurityCenter />}

        {/* ═══ SYSTEM SETTINGS ═══ */}
        {activeTab === "sys_settings" && <AdminSystemSettings />}

        {/* ═══ LOYALTY POINTS ═══ */}
        {activeTab === "loyalty" && <AdminLoyaltyPoints />}

        {/* ═══ AI FRAUD DETECTION ═══ */}
        {activeTab === "ai_fraud" && <AdminAiFraudDetection />}

        {/* ═══ GEO TRACKING ═══ */}
        {activeTab === "geo_tracking" && <AdminGeoTracking />}

        {/* ═══ SMART ROUTING ═══ */}
        {activeTab === "smart_routing" && <AdminSmartRouting />}

        {/* ═══ LIQUIDITY PREDICTION ═══ */}
        {activeTab === "liquidity" && <AdminLiquidityPrediction />}

        {/* ═══ REAL-TIME MONITOR ═══ */}
        {activeTab === "live_monitor" && <AdminRealtimeMonitor />}

        {/* ═══ RISK CONTROL ═══ */}
        {activeTab === "risk_control" && <AdminRiskControl />}

        {/* ═══ FLOAT MANAGEMENT ═══ */}
        {activeTab === "float_mgmt" && <AdminFloatManagement />}

        {/* ═══ REVENUE DASHBOARD ═══ */}
        {activeTab === "revenue" && <AdminRevenueDashboard />}

        {/* ═══ MFS MONITOR ═══ */}
        {activeTab === "mfs_monitor" && <AdminMfsMonitor />}

        {/* ═══ MERCHANT APPLICATIONS ═══ */}
        {activeTab === "merchant_apps" && <AdminMerchantApplications />}

        {/* ═══ API REQUESTS ═══ */}
        {activeTab === "api_requests" && <AdminApiRequests />}

        {/* ═══ TEAM ACTIVITY ═══ */}
        {activeTab === "team_activity" && <TeamActivityDashboard />}

        {/* ═══ DISTRIBUTORS ═══ */}
        {activeTab === "distributors" && <AdminDistributorManagement />}

        {/* ═══ SYSTEM HEALTH ═══ */}
        {activeTab === "sys_health" && <AdminSystemHealth />}

        {/* ═══ DATA EXPORT ═══ */}
        {activeTab === "data_export" && <AdminDataExport />}

        {/* ═══ USER SESSIONS ═══ */}
        {activeTab === "sessions" && <AdminUserSessions />}

        {/* ═══ COMPLAINTS ═══ */}
        {activeTab === "complaints" && <AdminComplaintManager />}

        {/* ═══ DEVICE MANAGER ═══ */}
        {activeTab === "devices" && <AdminDeviceManager />}

        {/* ═══ AUTO-SAVE MONITOR ═══ */}
        {activeTab === "auto_save" && <AdminAutoSaveMonitor />}

        {/* ═══ OTP MONITOR ═══ */}
        {activeTab === "otp_monitor" && <AdminOtpMonitor />}

        {/* ═══ COMMISSION LEDGER ═══ */}
        {activeTab === "commission_ledger" && <AdminCommissionLedger />}

        {/* ═══ DEPOSIT ACCOUNTS ═══ */}
        {activeTab === "deposit_accounts" && <AdminDepositAccounts />}

        {/* ═══ TRASH ═══ */}
        {activeTab === "trash" && (
          <div className="space-y-4">
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-muted-foreground" /> Deleted Users
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {deletedUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Trash2 className="w-10 h-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium text-foreground">Trash is empty</p>
                    <p className="text-xs text-muted-foreground mt-1">Deleted users will appear here</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left px-4 py-3 font-medium">Name</th>
                          <th className="text-left px-4 py-3 font-medium">Phone</th>
                          <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Balance</th>
                          <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Recovered</th>
                          <th className="text-left px-4 py-3 font-medium">Deleted</th>
                          <th className="text-left px-4 py-3 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deletedUsers.map((du: any) => (
                          <tr key={du.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">{du.name || "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground">{du.phone || "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">৳{(du.balance_at_deletion ?? 0).toLocaleString()}</td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              {du.balance_recovered > 0 ? (
                                <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                  ৳{du.balance_recovered.toLocaleString()}
                                </Badge>
                              ) : "—"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">
                              {du.deleted_at ? new Date(du.deleted_at).toLocaleDateString("en-BD", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openTrashDetail(du.id)}>
                                <Eye className="w-3 h-3 mr-1" /> View
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══ Trash Detail Sheet ═══ */}
        <Sheet open={!!trashDetailId} onOpenChange={(open) => { if (!open) { setTrashDetailId(null); setTrashDetail(null); } }}>
          <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
            <SheetHeader className="px-4 pt-4 pb-2 shrink-0">
              <SheetTitle className="text-base">Deleted User Details</SheetTitle>
              <SheetDescription className="text-xs">Archived data from before deletion</SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-1 px-4 pb-4">
              {trashDetailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : trashDetail ? (
                <div className="space-y-4">
                  {/* Profile snapshot */}
                  <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">Profile</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Name:</span> <span className="text-foreground font-medium">{trashDetail.name || "—"}</span></div>
                      <div><span className="text-muted-foreground">Phone:</span> <span className="text-foreground font-medium">{trashDetail.phone || "—"}</span></div>
                      <div><span className="text-muted-foreground">Balance:</span> <span className="text-foreground font-medium">৳{(trashDetail.balance_at_deletion ?? 0).toLocaleString()}</span></div>
                      <div><span className="text-muted-foreground">Recovered:</span> <span className="text-foreground font-medium">৳{(trashDetail.balance_recovered ?? 0).toLocaleString()}</span></div>
                      <div><span className="text-muted-foreground">Deleted:</span> <span className="text-foreground font-medium">{trashDetail.deleted_at ? new Date(trashDetail.deleted_at).toLocaleString() : "—"}</span></div>
                      <div><span className="text-muted-foreground">Reason:</span> <span className="text-foreground font-medium">{trashDetail.deletion_reason || "Manual"}</span></div>
                    </div>
                    {trashDetail.profile_data?.email && (
                      <div className="text-xs"><span className="text-muted-foreground">Email:</span> <span className="text-foreground">{trashDetail.profile_data.email}</span></div>
                    )}
                    {trashDetail.profile_data?.created_at && (
                      <div className="text-xs"><span className="text-muted-foreground">Account created:</span> <span className="text-foreground">{new Date(trashDetail.profile_data.created_at).toLocaleDateString()}</span></div>
                    )}
                  </div>

                  {/* Roles */}
                  {trashDetail.roles?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-1">Roles</h4>
                      <div className="flex gap-1.5 flex-wrap">
                        {trashDetail.roles.map((r: any, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">{r.role}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* KYC */}
                  {trashDetail.kyc_data && Object.keys(trashDetail.kyc_data).length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-1">KYC</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 rounded-lg p-3">
                        <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className="text-[10px] ml-1">{trashDetail.kyc_data.status || "—"}</Badge></div>
                        <div><span className="text-muted-foreground">NID:</span> <span className="text-foreground">{trashDetail.kyc_data.nid_number || "—"}</span></div>
                        <div><span className="text-muted-foreground">Full Name:</span> <span className="text-foreground">{trashDetail.kyc_data.full_name || "—"}</span></div>
                        <div><span className="text-muted-foreground">DOB:</span> <span className="text-foreground">{trashDetail.kyc_data.date_of_birth || "—"}</span></div>
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Transactions */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-1">
                      Transactions ({(trashDetail.transactions ?? []).length})
                    </h4>
                    {(trashDetail.transactions ?? []).length > 0 ? (
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {(trashDetail.transactions as any[]).slice(0, 50).map((txn: any, i: number) => (
                          <div key={i} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 text-xs">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className={`text-[10px] ${TXN_TYPE_COLORS[txn.type] ?? ""}`}>{txn.type}</Badge>
                              <span className="text-muted-foreground">
                                {txn.created_at ? new Date(txn.created_at).toLocaleDateString("en-BD", { month: "short", day: "numeric" }) : ""}
                              </span>
                            </div>
                            <span className="font-semibold text-foreground">৳{txn.amount?.toLocaleString()}</span>
                          </div>
                        ))}
                        {(trashDetail.transactions as any[]).length > 50 && (
                          <p className="text-xs text-muted-foreground text-center py-1">
                            +{(trashDetail.transactions as any[]).length - 50} more transactions
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No transactions</p>
                    )}
                  </div>

                  <Separator />

                  {/* Other data summary */}
                  {trashDetail.other_data && (
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-1">Other Data</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(trashDetail.other_data as Record<string, any[]>).map(([key, val]) => (
                          <div key={key} className="bg-muted/30 rounded-lg px-3 py-2">
                            <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}:</span>{" "}
                            <span className="text-foreground font-medium">{Array.isArray(val) ? val.length : "—"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Support conversations */}
                  {trashDetail.support_conversations?.messages?.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-1">
                          Support Messages ({trashDetail.support_conversations.messages.length})
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {trashDetail.support_conversations.conversations?.length || 0} conversation(s), {trashDetail.support_conversations.messages.length} message(s)
                        </p>
                      </div>
                    </>
                  )}

                  {/* Referrals */}
                  {trashDetail.referrals?.referrals?.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-1">
                          Referrals ({trashDetail.referrals.referrals.length})
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {trashDetail.referrals.rewards?.length || 0} reward(s) earned
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Failed to load details</p>
              )}
            </ScrollArea>
          </SheetContent>
        </Sheet>
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

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{deleteTarget?.name || deleteTarget?.phone}</strong> ({deleteTarget?.phone}) and all their data including transactions, KYC, orders, and authentication. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteUser(true)}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Soft-Delete Confirmation Dialog */}
      <AlertDialog open={!!softDeleteTarget} onOpenChange={(v) => { if (!v) setSoftDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate <strong>{softDeleteTarget?.name || softDeleteTarget?.phone}</strong> ({softDeleteTarget?.phone}) with a 30-day grace period before permanent deletion. The user will be blocked from logging in. You can reactivate them during the grace period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={softDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSoftDelete}
              disabled={softDeleting}
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              {softDeleting ? "Deactivating…" : "Deactivate (30-day grace)"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset PIN Confirmation Dialog */}
      <AlertDialog open={!!resetPinTarget} onOpenChange={(v) => { if (!v) setResetPinTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset User PIN</AlertDialogTitle>
            <AlertDialogDescription>
              Set a temporary PIN for <strong>{resetPinTarget?.name || resetPinTarget?.phone}</strong> ({resetPinTarget?.phone}). Share this PIN with the user securely — they should change it after logging in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Temporary PIN</label>
              <Input
                type="tel"
                inputMode="numeric"
                maxLength={4}
                value={tempPin}
                onChange={(e) => setTempPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="text-center text-2xl tracking-[0.5em] font-mono"
                placeholder="0000"
              />
              <p className="text-xs text-muted-foreground">Must be exactly 4 digits</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setTempPin(generateTempPin())}
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Generate New
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resettingPin}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetPin}
              disabled={resettingPin || tempPin.length !== 4}
            >
              {resettingPin ? "Resetting…" : "Reset PIN"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User Detail Drawer */}
      <Sheet open={!!detailUser} onOpenChange={(v) => { if (!v) { setDetailUser(null); setDetailData(null); } }}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 shrink-0">
            <SheetTitle className="text-lg">User Details</SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              {detailUser?.name || detailUser?.phone || "Loading..."}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 px-6 pb-6">
            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : detailData ? (
              <div className="space-y-6">
                {/* Profile Header */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {(detailData.profile?.name || "?")[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{detailData.profile?.name || "—"}</h3>
                      <p className="text-sm text-muted-foreground">{detailData.profile?.phone}</p>
                      {detailData.profile?.email && <p className="text-xs text-muted-foreground">{detailData.profile.email}</p>}
                    </div>
                    <Badge
                      variant={detailData.profile?.status === "suspended" ? "destructive" : detailData.profile?.status === "deactivated" ? "outline" : "secondary"}
                      className={detailData.profile?.status === "deactivated" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300" : ""}
                    >
                      {detailData.profile?.status || "active"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">Balance</p>
                      <p className="font-bold text-foreground">৳{parseFloat(detailData.profile?.balance || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">Referral Code</p>
                      <p className="font-mono text-foreground text-xs">{detailData.profile?.referral_code || "—"}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">Joined</p>
                      <p className="text-foreground text-xs">{detailData.profile?.created_at ? new Date(detailData.profile.created_at).toLocaleDateString() : "—"}</p>
                    </div>
                    {detailData.profile?.deactivated_at && (
                      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                        <p className="text-muted-foreground text-xs">Deactivated</p>
                        <p className="text-orange-700 dark:text-orange-300 text-xs">{new Date(detailData.profile.deactivated_at).toLocaleDateString()}</p>
                        {detailData.profile.scheduled_deletion_at && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Deletion: {new Date(detailData.profile.scheduled_deletion_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Roles */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Roles</h4>
                  {detailData.roles.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {detailData.roles.map((r: any, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs capitalize">{r.role}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No roles assigned (default customer)</p>
                  )}
                </div>

                <Separator />

                {/* KYC Status */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">KYC Status</h4>
                  {detailData.kyc ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant={detailData.kyc.status === "verified" ? "secondary" : detailData.kyc.status === "rejected" ? "destructive" : "outline"} className="text-xs capitalize">
                          {detailData.kyc.status}
                        </Badge>
                      </div>
                      {detailData.kyc.nid_number && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">NID</span>
                          <span className="font-mono text-foreground text-xs">{detailData.kyc.nid_number}</span>
                        </div>
                      )}
                      {detailData.kyc.face_match_score !== null && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Face Match</span>
                          <span className="text-foreground">{detailData.kyc.face_match_score}%</span>
                        </div>
                      )}
                      {detailData.kyc.reviewer_notes && (
                        <div className="bg-muted/50 rounded-lg p-2 text-xs text-muted-foreground">
                          <p className="font-medium text-foreground mb-0.5">Reviewer Notes</p>
                          {detailData.kyc.reviewer_notes}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No KYC submitted</p>
                  )}

                  {/* KYC Exemption Toggle */}
                  <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">KYC Exempt</p>
                        <p className="text-xs text-muted-foreground">Allow transactions without KYC</p>
                      </div>
                    </div>
                    <button
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${detailData.profile?.kyc_exempt ? "bg-primary" : "bg-input"}`}
                      onClick={async () => {
                        const newVal = !detailData.profile?.kyc_exempt;
                        const { error } = await supabase
                          .from("profiles")
                          .update({ kyc_exempt: newVal } as any)
                          .eq("user_id", detailUser.user_id);
                        if (error) {
                          toast.error("Failed to update KYC exemption");
                          return;
                        }
                        setDetailData((prev: any) => prev ? { ...prev, profile: { ...prev.profile, kyc_exempt: newVal } } : prev);
                        toast.success(newVal ? "User is now KYC-exempt" : "KYC exemption removed");
                        // Audit log
                        supabase.from("audit_logs").insert({
                          actor_id: (await supabase.auth.getSession()).data.session?.user.id,
                          action: newVal ? "kyc_exempt_granted" : "kyc_exempt_revoked",
                          entity_type: "user",
                          entity_id: detailUser.user_id,
                          details: { kyc_exempt: newVal },
                        }).then();
                      }}
                    >
                      <span className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg transition-transform ${detailData.profile?.kyc_exempt ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                </div>

                <Separator />

                {/* Reset PIN */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Account Security</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() => {
                      setResetPinTarget({
                        userId: detailUser.user_id,
                        name: detailData.profile?.name || "",
                        phone: detailData.profile?.phone || "",
                      });
                      setTempPin(generateTempPin());
                    }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset PIN
                  </Button>
                </div>

                <Separator />

                {/* Transaction Limits — Inline Editor */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-foreground">Transaction Limits</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-6 text-muted-foreground"
                      onClick={() => { setDetailUser(null); setDetailData(null); setActiveTab("limits"); }}
                    >
                      Full Manager →
                    </Button>
                  </div>
                  {(() => {
                    const TXN_TYPES = [
                      { key: "send", label: "Send Money" },
                      { key: "cashout", label: "Cash Out" },
                      { key: "banktransfer", label: "Bank Transfer" },
                      { key: "recharge", label: "Recharge" },
                      { key: "addmoney", label: "Add Money" },
                      { key: "cashin", label: "Cash In" },
                    ];
                    const PERIODS = ["daily", "monthly"] as const;
                    const overrides = detailData.limitOverrides || [];
                    const globals = detailData.globalLimits || [];

                    const getEffective = (txnType: string, period: string) => {
                      const now = new Date();
                      const ov = overrides.find((o: any) => o.txn_type === txnType && o.period === period && o.is_active !== false && (!o.expires_at || new Date(o.expires_at) >= now));
                      if (ov?.max_amount != null) return { amount: Number(ov.max_amount), count: Number(ov.max_count ?? 0), isCustom: true, overrideId: ov.id };
                      const gl = globals.find((g: any) => g.txn_type === txnType && g.period === period && g.applies_to === "user");
                      if (gl?.max_amount != null) return { amount: Number(gl.max_amount), count: Number(gl.max_count ?? 0), isCustom: false, overrideId: null };
                      return { amount: 0, count: 0, isCustom: false, overrideId: null };
                    };


                    const startEdit = (txnType: string, period: string) => {
                      const eff = getEffective(txnType, period);
                      setEditingLimit({
                        txnType, period,
                        oldAmount: eff.amount, oldCount: eff.count,
                        newAmount: String(eff.amount), newCount: String(eff.count),
                        isCustom: eff.isCustom, overrideId: eff.overrideId,
                      });
                    };

                    const saveOverride = async () => {
                      if (!editingLimit || !detailUser) return;
                      setSavingLimit(true);
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session?.user) throw new Error("Not authenticated");
                        const newAmt = Number(editingLimit.newAmount);
                        const newCnt = Number(editingLimit.newCount);
                        if (isNaN(newAmt) || newAmt < 0) throw new Error("Invalid amount");

                        const { error } = await supabase.from("user_limit_overrides").upsert({
                          target_user_id: detailUser.user_id,
                          txn_type: editingLimit.txnType,
                          period: editingLimit.period,
                          max_amount: newAmt,
                          max_count: newCnt,
                          is_active: true,
                          set_by: session.user.id,
                          reason: "Set from User Details sheet",
                        }, { onConflict: "target_user_id,txn_type,period" });
                        if (error) throw error;

                        // Audit log
                        supabase.from("audit_logs").insert({
                          actor_id: session.user.id,
                          action: "user_limit_override_set",
                          entity_type: "user_limit_overrides",
                          entity_id: detailUser.user_id,
                          details: {
                            txn_type: editingLimit.txnType, period: editingLimit.period,
                            previous: { amount: editingLimit.oldAmount, count: editingLimit.oldCount },
                            new_value: { amount: newAmt, count: newCnt },
                          },
                        }).then();

                        // Refresh
                        const freshData = await fetchUserDetails(detailUser.user_id);
                        setDetailData(freshData);
                        setEditingLimit(null);
                        toast.success("Limit override saved");
                      } catch (err: any) {
                        toast.error(err.message || "Failed to save");
                      } finally {
                        setSavingLimit(false);
                      }
                    };

                    const resetToDefault = async (txnType: string, period: string) => {
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session?.user) throw new Error("Not authenticated");
                        const { error } = await supabase.from("user_limit_overrides")
                          .update({ is_active: false })
                          .eq("target_user_id", detailUser.user_id)
                          .eq("txn_type", txnType)
                          .eq("period", period);
                        if (error) throw error;
                        supabase.from("audit_logs").insert({
                          actor_id: session.user.id,
                          action: "user_limit_override_reset",
                          entity_type: "user_limit_overrides",
                          entity_id: detailUser.user_id,
                          details: { txn_type: txnType, period },
                        }).then();
                        const freshData = await fetchUserDetails(detailUser.user_id);
                        setDetailData(freshData);
                        setEditingLimit(null);
                        toast.success("Reset to global default");
                      } catch (err: any) {
                        toast.error(err.message || "Failed to reset");
                      }
                    };

                    // Compute usage for this user
                    const userTxns = detailData.transactions || [];
                    const now = new Date();
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

                    // We need ALL completed txns this month – detailData.transactions is limited to 10
                    // Use detailUsage state instead (fetched when opening user details)

                    return (
                      <div className="space-y-2">
                        {TXN_TYPES.map(({ key, label }) =>
                          PERIODS.map((period) => {
                            const eff = getEffective(key, period);
                            const isEditing = editingLimit?.txnType === key && editingLimit?.period === period;
                            const hasChanged = isEditing && (editingLimit.newAmount !== String(editingLimit.oldAmount) || editingLimit.newCount !== String(editingLimit.oldCount));

                            // Usage data
                            const usageBucket = detailUsage?.[period === "daily" ? "daily" : "monthly"]?.[key];
                            const usedAmount = usageBucket?.usedAmount ?? 0;
                            const usedCount = usageBucket?.usedCount ?? 0;
                            const amtPct = eff.amount > 0 ? Math.min(100, Math.round((usedAmount / eff.amount) * 100)) : 0;
                            const cntPct = eff.count > 0 ? Math.min(100, Math.round((usedCount / eff.count) * 100)) : 0;
                            const maxPct = Math.max(amtPct, cntPct);
                            const barColor = maxPct >= 85 ? "bg-destructive" : maxPct >= 60 ? "bg-yellow-500" : "bg-emerald-500";

                            return (
                              <div key={`${key}-${period}`} className={`rounded-lg border px-3 py-2 text-xs transition-colors ${isEditing ? "border-primary/50 bg-primary/5" : "border-border/50 bg-muted/20"}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-foreground">{label}</span>
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 capitalize">{period}</Badge>
                                    {eff.isCustom && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/40 text-primary">Custom</Badge>}
                                  </div>
                                  {!isEditing && (
                                    <div className="flex items-center gap-1">
                                      <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={() => startEdit(key, period)}>Edit</Button>
                                      {eff.isCustom && (
                                        <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] text-destructive hover:text-destructive" onClick={() => resetToDefault(key, period)}>
                                          <RotateCcw className="w-3 h-3 mr-0.5" /> Reset
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {isEditing ? (
                                  <div className="mt-2 space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground w-16">Amount:</span>
                                      <span className={`line-through text-muted-foreground ${hasChanged ? "opacity-60" : ""}`}>৳{editingLimit.oldAmount.toLocaleString()}</span>
                                      <span className="text-muted-foreground">→</span>
                                      <Input type="number" min={0} value={editingLimit.newAmount}
                                        onChange={(e) => setEditingLimit({ ...editingLimit, newAmount: e.target.value })}
                                        className="h-7 w-28 text-xs" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground w-16">Max Txn:</span>
                                      <span className={`line-through text-muted-foreground ${hasChanged ? "opacity-60" : ""}`}>{editingLimit.oldCount}</span>
                                      <span className="text-muted-foreground">→</span>
                                      <Input type="number" min={0} value={editingLimit.newCount}
                                        onChange={(e) => setEditingLimit({ ...editingLimit, newCount: e.target.value })}
                                        className="h-7 w-28 text-xs" />
                                    </div>
                                    <div className="flex items-center gap-2 pt-1">
                                      <Button size="sm" className="h-6 text-[10px] px-3" disabled={savingLimit || !hasChanged} onClick={saveOverride}>
                                        {savingLimit ? "Saving…" : "Save Override"}
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setEditingLimit(null)}>Cancel</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-1 space-y-1">
                                    <div className="flex items-center gap-3">
                                      <span className="text-muted-foreground">৳{eff.amount.toLocaleString()}</span>
                                      {eff.count > 0 && <span className="text-muted-foreground">• {eff.count} txns</span>}
                                    </div>
                                    {/* Usage progress bar */}
                                    {eff.amount > 0 && (
                                      <div className="space-y-0.5">
                                        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${amtPct}%` }} />
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                          <span>৳{usedAmount.toLocaleString()} / ৳{eff.amount.toLocaleString()} ({amtPct}%)</span>
                                          {eff.count > 0 && <span>{usedCount} / {eff.count} txns</span>}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    );
                  })()}
                </div>

                <Separator />

                {/* Recent Transactions */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Recent Transactions</h4>
                  {detailData.transactions.length > 0 ? (
                    <div className="space-y-1.5">
                      {detailData.transactions.map((txn: any) => (
                        <div key={txn.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 text-xs">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className={`text-[10px] ${TXN_TYPE_COLORS[txn.type] ?? ""}`}>{txn.type}</Badge>
                            <span className="text-muted-foreground">
                              {new Date(txn.created_at).toLocaleDateString("en-BD", { month: "short", day: "numeric" })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">৳{txn.amount?.toLocaleString()}</span>
                            <Badge variant="outline" className="text-[10px]">{txn.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No transactions</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Failed to load details</p>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      </div>

      {/* ═══ Activity Feed – Desktop sidebar ═══ */}
      {!isMobile && showActivityFeed && (
        <aside className="hidden md:flex flex-col fixed right-0 top-0 bottom-0 w-72 bg-card border-l border-border z-40 animate-slide-in-right">
          <AdminActivityFeed />
        </aside>
      )}

      {/* ═══ Activity Feed – Mobile sheet ═══ */}
      {isMobile && (
        <Sheet open={showActivityFeed} onOpenChange={setShowActivityFeed}>
          <SheetContent side="right" className="w-[85vw] max-w-sm p-0 flex flex-col">
            <SheetHeader className="sr-only">
              <SheetTitle>Activity Feed</SheetTitle>
              <SheetDescription>Real-time log of admin-relevant database changes</SheetDescription>
            </SheetHeader>
            <AdminActivityFeed />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

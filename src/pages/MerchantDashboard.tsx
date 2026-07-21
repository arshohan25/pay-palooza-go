import { normalizeBDPhoneInput } from "@/lib/phoneInput";
/* MerchantDashboard v2 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { isWithinInterval, format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { usePhoneValidation } from "@/hooks/use-phone-validation";
import { useAuth } from "@/hooks/use-auth";
import { useStaffAccess } from "@/hooks/use-staff-access";
import { TAB_TO_PERMISSION } from "@/lib/staffPermissions";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalToggles } from "@/hooks/use-global-toggles";
import { useUserSessionTimeout } from "@/hooks/use-user-session-timeout";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, RefreshCw, QrCode, BarChart3, Wallet, Clock,
  Shield, Building2, Store, TrendingUp, DollarSign, Copy,
  CheckCircle2, Calendar, ArrowUpDown, Download, CreditCard,
  Percent, Receipt, ChevronLeft, ChevronRight, Eye, EyeOff, BanknoteIcon, Users,
  Zap, Gift, Star, ShieldCheck, Smartphone, Globe, TrendingDown,
  Target, Award, Sparkles, ArrowUpRight, ArrowDownRight, PieChart,
  Bell, Settings, HelpCircle, Landmark, BadgeCheck, Link, Share2,
  ExternalLink, Plus, Trash2, Check, Send, Banknote, Timer,
  ArrowRightLeft, Repeat, HandCoins, CalendarClock, CircleDollarSign, ScanLine,
  Lock, Delete, Menu, X, AlertTriangle, ChevronDown, Info, Package, MessageCircle, Search,
  Undo2, Ticket, XCircle, Loader2, LogOut, Megaphone
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { bnCategoryLabel } from "@/lib/merchantCategoryBn";
import MerchantBusinessKycFlow from "@/components/MerchantBusinessKycFlow";
import VendorOnboardingChecklist from "@/components/VendorOnboardingChecklist";
import { usePlatformBanks } from "@/hooks/use-platform-banks";
import { BankListLiveBadge } from "@/components/BankListLiveBadge";
import { RefreshBanksButton } from "@/components/RefreshBanksButton";
import { formatMdrPercent, mdrFraction } from "@/lib/mdr";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import QrScannerModal from "@/components/QrScannerModal";
import { verifyPin } from "@/lib/verifyPin";
import SlideToConfirm from "@/components/SlideToConfirm";
import { haptics } from "@/lib/haptics";
import DailyLimitBadge from "@/components/DailyLimitBadge";
import { useFeeConfig } from "@/hooks/use-fee-config";
import MerchantApiTab from "@/components/MerchantApiTab";
import MerchantApiAccessGate from "@/components/MerchantApiAccessGate";
import MerchantApiAccessStatusBanner from "@/components/MerchantApiAccessStatusBanner";
import MerchantAnalyticsTab from "@/components/MerchantAnalyticsTab";
import MerchantProductsTab from "@/components/MerchantProductsTab";
import MerchantOrdersTab from "@/components/MerchantOrdersTab";
import MerchantStoreSettingsTab from "@/components/MerchantStoreSettingsTab";
import { useChat } from "@/hooks/use-chat";
import MerchantInbox from "@/components/MerchantInbox";
import MerchantRefundsTab from "@/components/merchant/MerchantRefundsTab";
import MerchantStaffTab from "@/components/merchant/MerchantStaffTab";
import MerchantCustomersTab from "@/components/merchant/MerchantCustomersTab";
import MerchantCouponsTab from "@/components/merchant/MerchantCouponsTab";
import MerchantPayoutsTab from "@/components/merchant/MerchantPayoutsTab";
import MerchantBroadcastTab from "@/components/merchant/MerchantBroadcastTab";
import MerchantTodaySnapshot from "@/components/merchant/MerchantTodaySnapshot";
import MerchantInventoryAlerts from "@/components/MerchantInventoryAlerts";
import MerchantPayoutEtaCard from "@/components/merchant/MerchantPayoutEtaCard";
import MerchantDisputesTile from "@/components/merchant/MerchantDisputesTile";
import MerchantWeeklyDigestCard from "@/components/merchant/MerchantWeeklyDigestCard";
import NotificationPreferences from "@/components/NotificationPreferences";
import { useFutureFeatures } from "@/hooks/use-future-features";
import RequestAccessSheet from "@/components/merchant/RequestAccessSheet";
import VendorApplyBanner from "@/components/merchant/VendorApplyBanner";

/* ─── Types ─── */
type MerchTab = "overview" | "qr" | "products" | "orders" | "transactions" | "settlements" | "mdr" | "paylinks" | "analytics" | "api" | "store" | "inbox" | "refunds" | "staff" | "customers" | "coupons" | "payouts" | "notifications" | "broadcast";

interface MerchantInfo {
  id: string;
  business_name: string;
  business_name_bn?: string | null;
  category: string;
  status: string;
  mdr_rate: number;
  settlement_frequency: string;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_routing: string | null;
  bank_account_holder: string | null;
  bank_branch: string | null;
  trade_license: string | null;
  qr_code_data: string | null;
  qr_card_tagline?: string | null;
  qr_card_band_color_start?: string | null;
  qr_card_band_color_end?: string | null;
  qr_card_logo_url?: string | null;
}

interface TxnRow {
  id: string;
  short_id: string;
  type: string;
  amount: number;
  fee: number;
  commission: number;
  status: string;
  recipient_phone: string | null;
  recipient_name: string | null;
  description: string | null;
  reference: string | null;
  balance_after: number | null;
  created_at: string;
}

/* Flow-aware transaction display config */
const MERCHANT_INCOMING_TYPES = new Set(["payment", "receive", "addmoney", "cashin"]);

const MERCH_TX_CONFIG: Record<string, { label: string; icon: typeof CreditCard; iconColor: string; iconBg: string }> = {
  payment:      { label: "Received Payment",  icon: CreditCard,     iconColor: "text-emerald-600", iconBg: "bg-emerald-500/10" },
  receive:      { label: "Received",           icon: ArrowDownRight, iconColor: "text-emerald-600", iconBg: "bg-emerald-500/10" },
  addmoney:     { label: "Added Money",        icon: Plus,           iconColor: "text-blue-600",    iconBg: "bg-blue-500/10" },
  cashin:       { label: "Cash In",            icon: Banknote,       iconColor: "text-emerald-600", iconBg: "bg-emerald-500/10" },
  send:         { label: "Send Money",         icon: Send,           iconColor: "text-pink-600",    iconBg: "bg-pink-500/10" },
  cashout:      { label: "Cash Out",           icon: ArrowUpRight,   iconColor: "text-orange-600",  iconBg: "bg-orange-500/10" },
  banktransfer: { label: "Bank Transfer",      icon: Landmark,       iconColor: "text-indigo-600",  iconBg: "bg-indigo-500/10" },
  recharge:     { label: "Mobile Recharge",    icon: Smartphone,     iconColor: "text-cyan-600",    iconBg: "bg-cyan-500/10" },
  paybill:      { label: "Bill Payment",       icon: Receipt,        iconColor: "text-amber-600",   iconBg: "bg-amber-500/10" },
};

function getMerchTxHeadline(tx: TxnRow): string {
  const isIncoming = MERCHANT_INCOMING_TYPES.has(tx.type);
  const name = tx.recipient_name || tx.recipient_phone || "";
  switch (tx.type) {
    case "payment":      return name ? `Received Payment from ${name}` : "Received Payment";
    case "receive":      return name ? `Received from ${name}` : "Received";
    case "addmoney":     return "Added Money";
    case "cashin":       return "Cash In";
    case "send":         return name ? `Send Money to ${name}` : "Send Money";
    case "cashout":      return "Cash Out";
    case "banktransfer": return name ? `Bank Transfer to ${name}` : "Bank Transfer";
    case "recharge":     return name ? `Recharge ${name}` : "Mobile Recharge";
    case "paybill":      return name ? `Bill Pay — ${name}` : "Bill Payment";
    default:             return tx.description || tx.type;
  }
}

/* ─── Helpers ─── */
const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);

const mainTabs: { id: MerchTab; icon: typeof QrCode; label: string; labelKey: string; toggleKey?: string }[] = [
  { id: "overview",     icon: BarChart3,    label: "Overview", labelKey: "mdTabOverview" },
  { id: "products",     icon: Package,      label: "Products", labelKey: "mdTabProducts", toggleKey: "merchant_products" },
  { id: "orders",       icon: Receipt,      label: "Orders",   labelKey: "mdTabOrders",   toggleKey: "merchant_orders" },
];

const menuItems: { id: MerchTab; icon: typeof QrCode; label: string; desc: string; labelKey: string; descKey: string; toggleKey?: string }[] = [
  { id: "store",        icon: Store,        label: "Store Settings",   desc: "Customize your storefront",      labelKey: "mdMenuStore",         descKey: "mdMenuStoreDesc",         toggleKey: "merchant_store_settings" },
  { id: "analytics",    icon: PieChart,     label: "Analytics",        desc: "Insights, revenue & customers",  labelKey: "mdMenuAnalytics",     descKey: "mdMenuAnalyticsDesc",     toggleKey: "merchant_analytics" },
  { id: "transactions", icon: ArrowUpDown,  label: "History",          desc: "View all transactions",          labelKey: "mdMenuHistory",       descKey: "mdMenuHistoryDesc",       toggleKey: "merchant_transactions" },
  { id: "qr",           icon: QrCode,       label: "QR Code",          desc: "Your merchant QR code",          labelKey: "mdMenuQr",            descKey: "mdMenuQrDesc",            toggleKey: "merchant_qr" },
  { id: "api",          icon: Globe,        label: "API Integration",  desc: "API keys, webhooks & docs",      labelKey: "mdMenuApi",           descKey: "mdMenuApiDesc",           toggleKey: "merchant_api" },
  { id: "paylinks",     icon: Link,         label: "Pay Links",        desc: "Create & share payment links",   labelKey: "mdMenuPaylinks",      descKey: "mdMenuPaylinksDesc",      toggleKey: "merchant_paylinks" },
  { id: "settlements",  icon: BanknoteIcon, label: "Settlement",       desc: "Bank payouts & schedule",        labelKey: "mdMenuSettlement",    descKey: "mdMenuSettlementDesc",    toggleKey: "merchant_settlements" },
  { id: "mdr",          icon: Percent,      label: "Fees & Charges",   desc: "MDR rates & fee breakdown",      labelKey: "mdMenuFees",          descKey: "mdMenuFeesDesc",          toggleKey: "merchant_mdr" },
  { id: "refunds",      icon: Undo2,        label: "Refunds",          desc: "Issue & track customer refunds", labelKey: "mdMenuRefunds",       descKey: "mdMenuRefundsDesc",       toggleKey: "merchant_refunds" },
  { id: "staff",        icon: Users,        label: "Staff",            desc: "Manage employee access",         labelKey: "mdMenuStaff",         descKey: "mdMenuStaffDesc",         toggleKey: "merchant_staff" },
  { id: "customers",    icon: Users,        label: "Customers",        desc: "Customer directory & insights",  labelKey: "mdMenuCustomers",     descKey: "mdMenuCustomersDesc",     toggleKey: "merchant_customers" },
  { id: "broadcast",    icon: Megaphone,    label: "Broadcast",        desc: "Message your customers",         labelKey: "mdMenuBroadcast",     descKey: "mdMenuBroadcastDesc" },
  { id: "coupons",      icon: Ticket,       label: "Coupons",          desc: "Create store discount codes",    labelKey: "mdMenuCoupons",       descKey: "mdMenuCouponsDesc",       toggleKey: "merchant_coupons" },
  { id: "payouts",      icon: Landmark,     label: "Payouts",          desc: "Request bank withdrawals",       labelKey: "mdMenuPayouts",       descKey: "mdMenuPayoutsDesc",       toggleKey: "merchant_payouts" },
  { id: "notifications",icon: Bell,         label: "Notifications",    desc: "Push alerts & preferences",      labelKey: "mdMenuNotifications", descKey: "mdMenuNotificationsDesc" },
];

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  item: { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] } } },
};

/* ═══════════════════════════════════════════════════════════════════════════ */
const MerchantDashboard = () => {
  const { user, isAuthenticated, loading: authLoading, signOut } = useAuth();
  const { isStaff, staffRole, staffId, can, permissions: staffPermissions, merchantId: staffMerchantId, merchantName: staffMerchantName, loading: staffLoading, resolved: staffResolved } = useStaffAccess();
  const navigate = useNavigate();
  useUserSessionTimeout("merchant");
  const { toast } = useToast();
  const { lang, toggleLang, t } = useI18n();
  const { isDisabled } = useGlobalToggles();
  const futureFeatures = useFutureFeatures();
  void futureFeatures.visibility.future_merchant_growth_os;

  // Permission-based filter — owners (non-staff) see everything; staff see only granted features.
  const visibleMainTabs = useMemo(() => {
    let tabs = mainTabs.filter(t => !t.toggleKey || !isDisabled(t.toggleKey));
    if (isStaff) tabs = tabs.filter(t => can(TAB_TO_PERMISSION[t.id] ?? ""));
    return tabs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDisabled, isStaff, staffPermissions]);

  const visibleMenuItems = useMemo(() => {
    let items = menuItems.filter(item =>
      (item.id === "api" && !isStaff) || !item.toggleKey || !isDisabled(item.toggleKey)
    );
    if (isStaff) items = items.filter(item => can(TAB_TO_PERMISSION[item.id] ?? ""));
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDisabled, isStaff, staffPermissions]);

  const apiLocked = isDisabled("merchant_api");

  const [activeTab, setActiveTab] = useState<MerchTab>("overview");
  const [merchant, setMerchant] = useState<MerchantInfo | null>(null);
  const [balance, setBalance] = useState(0);
  const [showBalance, setShowBalance] = useState(false);
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [isMerchant, setIsMerchant] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const logoutTriggerRef = useRef<HTMLButtonElement>(null);
  const balanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [kycStatus, setKycStatus] = useState<"none" | "pending" | "approved" | "rejected">("none");

  useEffect(() => {
    if (!merchant?.id) return;
    let cancelled = false;
    const loadKyc = async () => {
      const { data } = await (supabase as any)
        .from("merchant_applications")
        .select("business_kyc_status")
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      const raw = (data?.business_kyc_status as string) || "";
      if (raw === "approved" || raw === "pending" || raw === "rejected") setKycStatus(raw);
      else if (merchant.status === "active") setKycStatus("approved");
      else setKycStatus("none");
    };
    loadKyc();
    return () => { cancelled = true; };
  }, [merchant?.id, merchant?.status]);

  const toggleBalance = () => {
    setShowBalance(v => {
      if (!v) {
        if (balanceTimerRef.current) clearTimeout(balanceTimerRef.current);
        balanceTimerRef.current = setTimeout(() => setShowBalance(false), 5000);
      } else {
        if (balanceTimerRef.current) clearTimeout(balanceTimerRef.current);
      }
      return !v;
    });
  };

  useEffect(() => {
    return () => { if (balanceTimerRef.current) clearTimeout(balanceTimerRef.current); };
  }, []);

  const handleLogout = useCallback(async () => {
    const loginRedirect = isStaff ? "/merchant-manager-login" : "/merchant-login";
    try { sessionStorage.setItem("mfs_manual_logout", "1"); } catch {}
    // Staff/manager logout must not leave the manager phone bound to this
    // device, otherwise the next visit to the manager login page would show
    // the previous manager's number instead of a clean form.
    if (isStaff) {
      try {
        localStorage.removeItem("mfs_device_phone");
        localStorage.removeItem("mfs_is_merchant_staff");
        localStorage.removeItem("mfs_has_authenticated");
      } catch {}
    }
    setLoggingOut(true);
    // Navigate first so the session watchdog (which fires on SIGNED_OUT)
    // doesn't race us to /merchant-login with an "expired" toast.
    navigate(loginRedirect, { replace: true });
    try {
      await signOut();
    } catch (err) {
      // ignore — already navigated away
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
      try { sessionStorage.removeItem("mfs_manual_logout"); } catch {}
    }
  }, [signOut, navigate, isStaff]);

  const loadData = useCallback(async () => {
    if (!user) return;
    // Wait for staff resolution to avoid a race where the owner-only branch
    // sets isMerchant=false before useStaffAccess has confirmed staff status.
    if (!staffResolved || staffLoading) return;
    setLoading(true);

    // If user is staff (not merchant owner), load the merchant they're linked to
    if (isStaff && staffMerchantId) {
      const [merchRes, profileRes] = await Promise.all([
        supabase.from("merchants").select("*").eq("id", staffMerchantId).single(),
        supabase.from("profiles").select("balance").eq("user_id", user.id).single(),
      ]);
      setIsMerchant(true); // treat as merchant for rendering
      setBalance(profileRes.data?.balance ?? 0);
      setMerchant(merchRes.data as MerchantInfo | null);
      setTxns([]); // staff don't see owner's transactions
      setLoading(false);
      console.info("[MerchantDashboard] loaded as staff", { userId: user.id, merchantId: staffMerchantId });
      return;
    }

    const [roleRes, profileRes, merchRes, txnRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "merchant"),
      supabase.from("profiles").select("balance").eq("user_id", user.id).single(),
      supabase.from("merchants").select("*").eq("user_id", user.id).single(),
      supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);
    const hasMerchantRole = (roleRes.data?.length ?? 0) > 0;
    setIsMerchant(hasMerchantRole);
    setBalance(profileRes.data?.balance ?? 0);
    setMerchant(merchRes.data as MerchantInfo | null);
    setTxns((txnRes.data ?? []) as TxnRow[]);
    setLoading(false);
    console.info("[MerchantDashboard] loaded as owner-check", { userId: user.id, hasMerchantRole });
  }, [user, isStaff, staffMerchantId, staffLoading, staffResolved]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime: auto-promote to merchant dashboard the moment the role is granted
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`merchant-role-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_roles', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if ((payload.new as any)?.role === 'merchant') {
            loadData();
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadData]);

  // Sound alert for incoming payments
  const playPaymentSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.25, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      };
      playTone(880, 0, 0.15);
      playTone(1100, 0.12, 0.15);
      playTone(1320, 0.24, 0.2);
    } catch {}
  }, []);

  // Real-time subscription for balance and transaction updates
  const knownTxnIdsRef = React.useRef(new Set<string>());
  useEffect(() => {
    // Seed known IDs to avoid alerting on initial load
    txns.forEach(t => knownTxnIdsRef.current.add(t.id));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('merchant-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.new && typeof payload.new.balance === 'number') {
          setBalance(payload.new.balance);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, (payload) => {
        const newTxn = payload.new as TxnRow;
        setTxns(prev => [newTxn, ...prev]);

        // Only alert for incoming payments (receive/payment/cashin/addmoney)
        if (!knownTxnIdsRef.current.has(newTxn.id) && ["receive", "payment", "cashin", "addmoney"].includes(newTxn.type)) {
          knownTxnIdsRef.current.add(newTxn.id);
          playPaymentSound();
          haptics.success();
          toast({
            title: `💰 Payment Received!`,
            description: `৳${fmt(newTxn.amount)} from ${newTxn.recipient_name || newTxn.recipient_phone || "Customer"}`,
          });
          // Browser notification
          if (Notification.permission === "granted") {
            new Notification("Payment Received 💰", {
              body: `৳${fmt(newTxn.amount)} from ${newTxn.recipient_name || newTxn.recipient_phone || "Customer"}`,
              icon: "/icons/icon-192.png",
            });
          }
        }
        knownTxnIdsRef.current.add(newTxn.id);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'merchants', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.new) {
          setMerchant(prev => (prev ? { ...prev, ...(payload.new as Partial<MerchantInfo>) } : (payload.new as MerchantInfo)));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, playPaymentSound, toast]);

  // Optimistic header update when Store Settings save begins
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { merchantId?: string; name?: string; nameBn?: string | null } | undefined;
      if (!detail?.name && detail?.nameBn === undefined) return;
      setMerchant(prev => {
        if (!prev) return prev;
        if (detail.merchantId && prev.id !== detail.merchantId) return prev;
        return {
          ...prev,
          ...(detail.name ? { business_name: detail.name } : {}),
          ...(detail.nameBn !== undefined ? { business_name_bn: detail.nameBn } : {}),
        };
      });
    };
    window.addEventListener("merchant:business-name-preview", handler as EventListener);
    return () => window.removeEventListener("merchant:business-name-preview", handler as EventListener);
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const paymentTxns = useMemo(() => txns.filter(t => t.type === "payment"), [txns]);

  if (authLoading || staffLoading || !staffResolved || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center animate-pulse">
            <Store size={24} className="text-primary-foreground" />
          </div>
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
        <Shield size={48} className="text-muted-foreground" />
        <p className="text-lg font-semibold text-foreground">Login required</p>
        <Button onClick={() => navigate("/")} variant="outline">Go to Login</Button>
      </div>
    );
  }
  // Only show the "Become a Vendor" benefits page when we have a definitive
  // answer that the user is neither a merchant owner nor active staff.
  if (isMerchant === false && staffResolved && !isStaff) {
    console.info("[MerchantDashboard] rendering benefits page", { userId: user?.id, isStaff, staffResolved, isMerchant });
    return <MerchantBenefitsPage navigate={navigate} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Premium Header ── */}
      <header className="relative overflow-hidden px-4 pt-6 pb-14">
        {/* Gradient background with orbs */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(150deg, hsl(24 90% 50%) 0%, hsl(16 82% 40%) 40%, hsl(350 65% 35%) 100%)"
        }} />
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20" style={{
          background: "radial-gradient(circle, hsl(36 95% 60%) 0%, transparent 70%)"
        }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10" style={{
          background: "radial-gradient(circle, hsl(0 0% 100%) 0%, transparent 70%)"
        }} />

        <div className="relative  text-primary-foreground">
          <div className="flex items-center justify-between mb-5">
            <motion.button
              ref={logoutTriggerRef}
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowLogoutConfirm(true)}
              className="tap-target h-10 px-3 rounded-xl glass-hero flex items-center gap-1.5 text-[12px] font-semibold"
              aria-label={t("logout")}
            >
              <LogOut size={15} />
              <span>{t("logout")}</span>
            </motion.button>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleLang}
                className="tap-target h-10 px-3 rounded-xl glass-hero flex items-center gap-1 text-[12px] font-bold"
                aria-label="Switch language"
                title="Switch language"
              >
                <Globe size={14} />
                <span>{lang === "en" ? "বাং" : "EN"}</span>
              </button>
              <button onClick={loadData} className="tap-target w-10 h-10 rounded-xl glass-hero flex items-center justify-center">
                <RefreshCw size={16} />
              </button>
              <button onClick={() => setShowMenu(true)} className="tap-target w-10 h-10 rounded-xl glass-hero flex items-center justify-center">
                <Menu size={16} />
              </button>
            </div>
          </div>

          {/* Business identity */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl glass-hero flex items-center justify-center ring-2 ring-white/20">
              <Store size={26} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight truncate">{(lang === "bn" && merchant?.business_name_bn) ? merchant.business_name_bn : (merchant?.business_name || "Merchant")}</h1>
                {kycStatus === "approved" ? (
                  <span title="KYC verified" className="inline-flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded-full bg-emerald-400/25 border border-emerald-200/40 text-emerald-50 text-[9px] font-bold backdrop-blur-sm">
                    <BadgeCheck size={11} /> {t("mdKyc")}
                  </span>
                ) : kycStatus === "pending" ? (
                  <span title="KYC under review" className="inline-flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded-full bg-yellow-400/25 border border-yellow-200/40 text-yellow-50 text-[9px] font-bold backdrop-blur-sm">
                    <Clock size={10} /> {t("mdKyc")}
                  </span>
                ) : kycStatus === "rejected" ? (
                  <span title="KYC rejected" className="inline-flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded-full bg-red-400/25 border border-red-200/40 text-red-50 text-[9px] font-bold backdrop-blur-sm">
                    <AlertTriangle size={10} /> {t("mdKyc")}
                  </span>
                ) : (
                  <span title="KYC not started" className="inline-flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded-full bg-white/15 border border-white/20 text-white/90 text-[9px] font-bold backdrop-blur-sm">
                    <Shield size={10} /> {t("mdKyc")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {isStaff && (
                  <Badge className="text-[9px] bg-blue-400/30 border-blue-300/30 text-blue-100 backdrop-blur-sm">
                    <Users size={8} className="mr-0.5" />Staff · {staffRole}
                  </Badge>
                )}
                <Badge className="text-[9px] bg-white/15 border-white/20 text-white capitalize backdrop-blur-sm">{lang === "bn" ? bnCategoryLabel(merchant?.category, t("mdCategoryRetail")) : (merchant?.category || t("mdCategoryRetail"))}</Badge>
                <Badge className="text-[9px] bg-white/15 border-white/20 text-white backdrop-blur-sm">
                  <Zap size={8} className="mr-0.5" />{merchant?.settlement_frequency || "T+1"}
                </Badge>
                <Badge className={`text-[9px] border-0 backdrop-blur-sm ${merchant?.status === "active" ? "bg-green-500/30 text-green-100" : "bg-yellow-500/30 text-yellow-100"}`}>
                  {merchant?.status === "active"
                    ? t("mdStatusActive")
                    : merchant?.status === "pending"
                      ? t("mdStatusPending")
                      : merchant?.status === "suspended"
                        ? t("mdStatusSuspended")
                        : (merchant?.status || t("mdStatusActive"))}
                </Badge>
              </div>
            </div>
          </div>

          {/* Balance hero — hidden for staff, tap to reveal for owners */}
          {!isStaff && (
            <div className="glass-hero rounded-2xl p-4 w-full">
              <div className="flex items-center justify-between gap-3">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={toggleBalance}
                  className="w-fit max-w-full text-left"
                  aria-label={showBalance ? t("mdHideBalance") : t("mdTapToSeeBalance")}
                >
                  <p className="text-[11px] font-medium text-white/60 uppercase tracking-wider">{t("mdAvailableBalance")}</p>
                  <AnimatePresence mode="wait">
                    {showBalance ? (
                      <motion.p key="bal" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="text-3xl font-black tracking-tight mt-0.5 flex items-center gap-2">
                        ৳{fmt(balance)}
                        <EyeOff size={14} className="opacity-50" />
                      </motion.p>
                    ) : (
                      <motion.div key="hidden" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex items-center gap-2 mt-1.5 bg-white/10 rounded-xl px-3 py-1.5 w-fit">
                        <Eye size={13} className="opacity-80" />
                        <span className="text-[12px] font-semibold opacity-90">{t("mdTapToSeeBalance")}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setActiveTab("qr")}
                  className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0 active:bg-white/20 transition-colors"
                >
                  <QrCode size={22} />
                </motion.button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── Quick Stats Grid ── */}
      <div className=" px-4 -mt-6 relative z-10">
        <motion.div
          variants={stagger.container} initial="hidden" animate="show"
          className="grid grid-cols-3 gap-2.5"
        >
          {(() => {
            const todayTxns = paymentTxns.filter(t => new Date(t.created_at).toDateString() === new Date().toDateString());
            const todaySales = todayTxns.reduce((s, t) => s + t.amount, 0);
            const yesterdayTxns = paymentTxns.filter(t => {
              const y = new Date(); y.setDate(y.getDate() - 1);
              return new Date(t.created_at).toDateString() === y.toDateString();
            });
            const yesterdaySales = yesterdayTxns.reduce((s, t) => s + t.amount, 0);
            const salesGrowth = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales * 100) : 0;

            return [
              { label: t("mdTodaySales"), value: `৳${fmt(todaySales)}`, icon: TrendingUp, trend: salesGrowth, gradient: "from-emerald-500/10 to-emerald-600/5" },
              { label: t("mdTransactions"), value: todayTxns.length.toString(), icon: Receipt, trend: null, gradient: "from-blue-500/10 to-blue-600/5" },
              { label: t("mdCustomers"), value: new Set(paymentTxns.map(t => t.recipient_phone)).size.toString(), icon: Users, trend: null, gradient: "from-purple-500/10 to-purple-600/5" },
            ].map((s, i) => (
              <motion.div key={s.label} variants={stagger.item}>
                <Card className={`p-3 border-0 shadow-elevated bg-gradient-to-br ${s.gradient} backdrop-blur-sm`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <s.icon size={15} className="text-primary" />
                    {s.trend !== null && (
                      <span className={`text-[9px] font-bold flex items-center ${s.trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {s.trend >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {Math.abs(s.trend).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-extrabold text-foreground">{s.value}</p>
                  <p className="text-[9px] text-muted-foreground font-medium mt-0.5">{s.label}</p>
                </Card>
              </motion.div>
            ));
          })()}
        </motion.div>
      </div>

      {/* ── Tab strip ── */}
      <div className=" px-4 mt-3">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-2 bg-muted/50 rounded-2xl p-1.5">
          {visibleMainTabs.map(tab => {
            const active = activeTab === tab.id;
            const label = tab.id === "overview" ? t("mdTabOverview") : tab.id === "products" ? t("mdTabProducts") : tab.id === "orders" ? t("mdTabOrders") : tab.label;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all press-effect flex-1 justify-center ${
                  active ? "text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: "linear-gradient(135deg, hsl(24 90% 50%), hsl(350 65% 38%))" }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <tab.icon size={13} />{label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Overview Content ── */}
      {activeTab === "overview" && (
        <div className="px-4 py-4 pb-24">
          {user && !isStaff && <VendorApplyBanner userId={user.id} />}
          <MerchOverview merchant={merchant} balance={balance} paymentTxns={paymentTxns} allTxns={txns} onRefresh={loadData} onSeeAll={() => setActiveTab("transactions")} onOpenInbox={() => setActiveTab("inbox")} isStaff={isStaff} can={can} staffId={staffId} />
        </div>
      )}

      {/* ── Products / Orders slide-up overlay with tab header ── */}
      <AnimatePresence>
        {(activeTab === "products" || activeTab === "orders") && (
          <motion.div
            key="products-orders-overlay"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", bounce: 0.12, duration: 0.65 }}
            className="fixed inset-0 z-[70] bg-background flex flex-col"
          >
            {/* Sticky tab header */}
            <div className="shrink-0 bg-background border-b border-border/50 px-4 pt-3 pb-2">
              <div className="flex gap-1.5 bg-muted/50 rounded-2xl p-1.5">
                {visibleMainTabs.map(tab => {
                  const active = activeTab === tab.id;
                  const label = tab.id === "overview" ? t("mdTabOverview") : tab.id === "products" ? t("mdTabProducts") : tab.id === "orders" ? t("mdTabOrders") : tab.label;
                  return (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className={`relative flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all press-effect flex-1 justify-center ${
                        active ? "text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="activeTabOverlay"
                          className="absolute inset-0 rounded-xl"
                          style={{ background: "linear-gradient(135deg, hsl(24 90% 50%), hsl(350 65% 38%))" }}
                          transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        <tab.icon size={13} />{label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Tab content with fade-up */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35 }}
                  className="px-4 py-4"
                >
                  {activeTab === "products" && merchant && (
                    <>
                      {user && !isStaff && <VendorApplyBanner userId={user.id} />}
                      <MerchantProductsTab merchantId={merchant.id} businessName={merchant.business_name} />
                    </>
                  )}
                  {activeTab === "orders" && merchant && (
                    <>
                      {user && !isStaff && <VendorApplyBanner userId={user.id} />}
                      <MerchantOrdersTab merchantId={merchant.id} />
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Full-screen overlay for other non-overview tabs ── */}
      <AnimatePresence>
        {activeTab !== "overview" && activeTab !== "products" && activeTab !== "orders" && (
          <motion.div
            key={`fullscreen-${activeTab}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] bg-background flex flex-col"
          >
            {activeTab !== "inbox" && (
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-background shrink-0">
                <button onClick={() => setActiveTab("overview")} className="tap-target w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center">
                  <ArrowLeft size={16} className="text-foreground" />
                </button>
                <h2 className="text-sm font-bold text-foreground">
                  {(() => {
                    const tab = [...mainTabs, ...menuItems].find(x => x.id === activeTab);
                    if (!tab) return t("mdBack");
                    return t(tab.labelKey as any);
                  })()}
                </h2>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {activeTab === "inbox"        && <MerchantInbox onBack={() => setActiveTab("overview")} />}
              {activeTab === "store"        && merchant && <div className="px-4 py-4"><MerchantStoreSettingsTab merchantId={merchant.id} businessName={merchant.business_name} /></div>}
              {activeTab === "qr"           && <div className="px-4 py-4"><QRTab merchant={merchant} toast={toast} /></div>}
              {activeTab === "analytics"    && merchant && <div className="px-4 py-4"><MerchantAnalyticsTab merchantId={merchant.id} /></div>}
              {activeTab === "paylinks"     && <div className="px-4 py-4"><PayLinksTab merchant={merchant} toast={toast} /></div>}
              {activeTab === "transactions" && <div className="px-4 py-4"><TxnTab txns={txns} merchant={merchant} /></div>}
              {activeTab === "settlements"  && <div className="px-4 py-4"><SettlementTab merchant={merchant} paymentTxns={paymentTxns} /></div>}
              {activeTab === "mdr"          && <div className="px-4 py-4"><MDRTab merchant={merchant} paymentTxns={paymentTxns} /></div>}
              {activeTab === "api"          && merchant && (
                <div className="px-4 py-4 space-y-4">
                  {user && <MerchantApiAccessStatusBanner userId={user.id} merchantId={merchant.id} visible={!isStaff} />}
                  {apiLocked
                    ? <MerchantApiAccessGate userId={user!.id} merchantId={merchant.id} />
                    : <MerchantApiTab merchantId={merchant.id} />}
                </div>
              )}
              {activeTab === "refunds"      && merchant && <div className="px-4 py-4"><MerchantRefundsTab merchantId={merchant.id} /></div>}
              {activeTab === "staff"        && merchant && <div className="px-4 py-4"><MerchantStaffTab merchantId={merchant.id} /></div>}
              {activeTab === "customers"    && merchant && <div className="px-4 py-4"><MerchantCustomersTab merchantId={merchant.id} /></div>}
              {activeTab === "coupons"      && merchant && <div className="px-4 py-4"><MerchantCouponsTab merchantId={merchant.id} /></div>}
              {activeTab === "payouts"      && merchant && <div className="px-4 py-4"><MerchantPayoutsTab merchantId={merchant.id} /></div>}
              {activeTab === "broadcast"    && merchant && <div className="px-4 py-4"><MerchantBroadcastTab merchantId={merchant.id} /></div>}
              {activeTab === "notifications" && <div className="px-4 py-4"><NotificationPreferences scope="merchant" /></div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hamburger Menu Drawer ── */}
      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60"
              onClick={() => setShowMenu(false)}
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", bounce: 0.12, duration: 0.4 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-72 bg-card shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-border/50">
                <h3 className="text-sm font-bold text-foreground">{t("mdMoreOptions")}</h3>
                <button onClick={() => setShowMenu(false)} className="tap-target w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 p-3 space-y-1.5 overflow-y-auto">
                {visibleMenuItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setShowMenu(false); }}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all ${
                      activeTab === item.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      activeTab === item.id ? "bg-primary/15" : "bg-muted/60"
                    }`}>
                      <item.icon size={18} className={activeTab === item.id ? "text-primary" : "text-muted-foreground"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold ${activeTab === item.id ? "text-primary" : "text-foreground"}`}>{t(item.labelKey as any)}</p>
                      <p className="text-[10px] text-muted-foreground">{t(item.descKey as any)}</p>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </button>
                ))}
              </div>
              <div className="p-4 border-t border-border/50">
                <div className="p-3 rounded-xl bg-muted/30 text-center">
                  <p className="text-[10px] text-muted-foreground">
                    <Store size={12} className="inline mr-1" />
                    {((lang === "bn" && merchant?.business_name_bn) ? merchant.business_name_bn : (merchant?.business_name || "Merchant"))} · {lang === "bn" ? bnCategoryLabel(merchant?.category, t("mdCategoryRetail")) : (merchant?.category || "retail")}
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Floating Chat FAB ── */}
      {activeTab !== "inbox" && (
        <MerchantChatFAB userId={user?.id ?? null} onOpenInbox={() => setActiveTab("inbox")} />
      )}

      {/* ── Logout confirmation ── */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={(open) => !loggingOut && setShowLogoutConfirm(open)}>
        <AlertDialogContent
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            logoutTriggerRef.current?.focus();
          }}
          onEscapeKeyDown={(e) => {
            if (loggingOut) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (loggingOut) e.preventDefault();
          }}
          className="max-w-[340px] rounded-[22px] border border-white/10 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-indigo-950/95 backdrop-blur-2xl p-0 overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]"
        >
          <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-rose-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl" />

          <div className="relative px-5 pt-6 pb-5">
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-rose-500/30 to-rose-700/20 border border-rose-400/30 shadow-[0_8px_24px_-8px_rgba(244,63,94,0.5)]">
                <LogOut size={20} className="text-rose-300" />
              </div>
              <AlertDialogHeader className="space-y-1.5">
                <AlertDialogTitle className="text-[16px] font-semibold text-white tracking-tight">
                  Sign out?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[12.5px] leading-relaxed text-white/60">
                  You'll return to the merchant login screen.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>

            <div className="mt-5 flex items-center justify-center gap-2.5">
              <AlertDialogCancel
                disabled={loggingOut}
                className="m-0 h-10 min-w-[88px] rounded-full border border-white/15 bg-white/5 px-5 text-[13px] font-semibold text-white/80 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
              >
                {loggingOut ? <span className="text-white/50">Please wait</span> : "No"}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleLogout();
                }}
                disabled={loggingOut}
                className="m-0 h-10 min-w-[88px] rounded-full border border-rose-400/40 bg-gradient-to-r from-rose-500 to-rose-600 px-5 text-[13px] font-semibold text-white shadow-[0_8px_22px_-6px_rgba(244,63,94,0.6)] hover:from-rose-400 hover:to-rose-500 hover:shadow-[0_10px_28px_-6px_rgba(244,63,94,0.75)] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none"
              >
                {loggingOut ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={13} className="animate-spin" />
                    ...
                  </span>
                ) : (
                  "Yes"
                )}
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ── Benefits Page (for non-merchants) ── */
const MerchantBenefitsPage = ({ navigate }: { navigate: (path: string) => void }) => {
  const [kycFlowOpen, setKycFlowOpen] = useState(false);
  const [kycStatus, setKycStatus] = useState<"none" | "pending" | "approved" | "rejected">("none");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const refreshStatus = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setKycStatus("none");
      setLoadingStatus(false);
      return;
    }
    const { data } = await supabase
      .from("merchants")
      .select("business_kyc_status, business_kyc_rejection_reason")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (!data) {
      setKycStatus("none");
      setRejectionReason(null);
    } else {
      const s = (data.business_kyc_status as string) || "pending";
      if (s === "approved" || s === "pending" || s === "rejected") {
        setKycStatus(s);
      } else {
        setKycStatus("pending");
      }
      setRejectionReason(data.business_kyc_rejection_reason ?? null);
    }
    setLoadingStatus(false);
  }, []);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const benefits = [
    { icon: QrCode, title: "QR Payments", desc: "Accept instant payments via QR scan — no card machine needed", color: "from-primary/20 to-primary/5" },
    { icon: Zap, title: "Instant Settlement", desc: "Get your money next business day with T+1 settlement", color: "from-amber-500/20 to-amber-500/5" },
    { icon: TrendingUp, title: "Growth Analytics", desc: "Track sales, customers & revenue trends in real-time", color: "from-blue-500/20 to-blue-500/5" },
    { icon: ShieldCheck, title: "Fraud Protection", desc: "AI-powered fraud detection keeps your business safe", color: "from-emerald-500/20 to-emerald-500/5" },
    { icon: Percent, title: "Low MDR Rates", desc: "Industry-lowest merchant discount rates starting 0.5%", color: "from-purple-500/20 to-purple-500/5" },
    { icon: Globe, title: "Online Presence", desc: "Digital storefront & payment link for remote customers", color: "from-rose-500/20 to-rose-500/5" },
  ];

  const stats = [
    { value: "50K+", label: "Active Merchants" },
    { value: "৳2B+", label: "Monthly Volume" },
    { value: "0.5%", label: "Lowest MDR" },
    { value: "T+1", label: "Settlement" },
  ];

  const ctaLabel =
    kycStatus === "approved" ? "Go to Merchant Dashboard"
    : kycStatus === "pending" ? "View Application Status"
    : kycStatus === "rejected" ? "Reapply Now"
    : "Apply as Vendor";

  const handleCtaClick = () => {
    if (kycStatus === "approved") {
      window.location.reload();
    } else {
      setKycFlowOpen(true);
    }
  };

  const StatusPill = () => {
    if (loadingStatus || kycStatus === "none") return null;
    if (kycStatus === "pending") {
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Clock size={14} className="text-amber-600 shrink-0" />
          <p className="text-xs font-semibold text-amber-700">Application under review — we'll notify you once approved</p>
        </div>
      );
    }
    if (kycStatus === "rejected") {
      return (
        <div className="flex flex-col gap-1.5 px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-2">
            <XCircle size={14} className="text-destructive shrink-0" />
            <p className="text-xs font-semibold text-destructive">Application rejected — action required</p>
          </div>
          {rejectionReason && (
            <p className="text-[11px] text-destructive/80 leading-relaxed pl-6">{rejectionReason}</p>
          )}
        </div>
      );
    }
    if (kycStatus === "approved") {
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
          <p className="text-xs font-semibold text-emerald-700">Verified vendor — refresh to enter your dashboard</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden px-4 pt-8 pb-16">
        <div className="absolute inset-0" style={{
          background: "linear-gradient(150deg, hsl(24 90% 50%) 0%, hsl(16 82% 40%) 40%, hsl(350 65% 35%) 100%)"
        }} />
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-15" style={{
          background: "radial-gradient(circle, hsl(36 95% 65%) 0%, transparent 70%)"
        }} />

        <div className="relative  text-primary-foreground">
          <button onClick={() => navigate("/")} className="tap-target w-10 h-10 rounded-xl glass-hero flex items-center justify-center mb-8">
            <ArrowLeft size={18} />
          </button>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-amber-200" />
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/70">Grow Your Business</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight leading-tight mb-3">
              Accept Digital Payments.<br />
              <span className="text-amber-200">Grow Your Shop.</span>
            </h1>
            <p className="text-sm text-white/75 leading-relaxed max-w-sm">
              Join thousands of shop owners accepting QR payments, tracking sales, and growing their business — all from one dashboard.
            </p>
          </motion.div>
        </div>
      </header>

      <div className=" px-4 -mt-8 relative z-10 pb-24 space-y-6">
        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="grid grid-cols-4 gap-2"
        >
          {stats.map(s => (
            <Card key={s.label} className="p-3 border-0 shadow-elevated text-center">
              <p className="text-base font-black text-foreground">{s.value}</p>
              <p className="text-[8px] text-muted-foreground font-semibold uppercase tracking-wide">{s.label}</p>
            </Card>
          ))}
        </motion.div>

        {/* Step-by-step vendor onboarding checklist */}
        <VendorOnboardingChecklist onApply={() => setKycFlowOpen(true)} />

        {/* Benefits grid */}
        <div>
          <h2 className="text-base font-bold text-foreground mb-3 px-1">Why Become a Vendor?</h2>
          <motion.div
            variants={stagger.container} initial="hidden" animate="show"
            className="grid grid-cols-2 gap-3"
          >
            {benefits.map(b => (
              <motion.div key={b.title} variants={stagger.item}>
                <Card className={`p-4 border-0 shadow-card bg-gradient-to-br ${b.color} h-full`}>
                  <div className="w-10 h-10 rounded-xl bg-background/80 flex items-center justify-center mb-3 shadow-sm">
                    <b.icon size={18} className="text-foreground" />
                  </div>
                  <p className="text-sm font-bold text-foreground mb-1">{b.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{b.desc}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Testimonial */}
        <Card className="p-5 border-0 shadow-elevated relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10" style={{
            background: "radial-gradient(circle, hsl(24 90% 50%) 0%, transparent 70%)"
          }} />
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Star size={18} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                {[1,2,3,4,5].map(s => <Star key={s} size={10} className="text-amber-400 fill-amber-400" />)}
              </div>
              <p className="text-xs text-foreground leading-relaxed italic">
                "Since joining as a merchant, my daily sales tracking is effortless. The QR payment setup took 2 minutes and customers love it!"
              </p>
              <p className="text-[10px] text-muted-foreground mt-2 font-semibold">— Rahim, Grocery Shop Owner</p>
            </div>
          </div>
        </Card>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="space-y-3"
        >
          <StatusPill />
          <Button
            onClick={handleCtaClick}
            disabled={loadingStatus}
            className="w-full h-14 rounded-2xl text-base font-bold shadow-glow-lg"
            style={{ background: "linear-gradient(135deg, hsl(24 90% 50%), hsl(350 65% 38%))" }}
          >
            {loadingStatus ? (
              <><Loader2 size={18} className="mr-2 animate-spin" /> Loading…</>
            ) : (
              <><Store size={18} className="mr-2" /> {ctaLabel}</>
            )}
          </Button>
          <Button onClick={() => navigate("/")} variant="outline" className="w-full h-12 rounded-2xl">
            <ArrowLeft size={16} className="mr-2" /> Back to Home
          </Button>
        </motion.div>
      </div>

      <MerchantBusinessKycFlow
        open={kycFlowOpen}
        onOpenChange={(v) => {
          setKycFlowOpen(v);
          if (!v) refreshStatus();
        }}
      />
    </div>
  );
};


/* ═══════════════════════════════════════════════════════════════════════════ */
/* ── Overview Tab ── */
const MerchOverview = ({ merchant, balance, paymentTxns, allTxns, onRefresh, onSeeAll, onOpenInbox, isStaff, can, staffId }: { merchant: MerchantInfo | null; balance: number; paymentTxns: TxnRow[]; allTxns: TxnRow[]; onRefresh: () => void; onSeeAll: () => void; onOpenInbox: () => void; isStaff: boolean; can: (key: string) => boolean; staffId: string | null }) => {
  const { toast } = useToast();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { totalUnread } = useChat();
  const [showSendMoney, setShowSendMoney] = useState(false);
  const [showCashOut, setShowCashOut] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const [showSettlementConfig, setShowSettlementConfig] = useState(false);
  const [requestSheet, setRequestSheet] = useState<{ label: string } | null>(null);
  const [overviewSelectedTx, setOverviewSelectedTx] = useState<TxnRow | null>(null);

  const totalRevenue = paymentTxns.reduce((s, t) => s + t.amount, 0);
  const mdrDeducted = Math.round(totalRevenue * mdrFraction(merchant?.mdr_rate));
  const avgTxn = paymentTxns.length > 0 ? Math.round(totalRevenue / paymentTxns.length) : 0;
  const uniqueCustomers = new Set(paymentTxns.map(t => t.recipient_phone)).size;

  const todayTxns = paymentTxns.filter(t => new Date(t.created_at).toDateString() === new Date().toDateString());
  const todayRevenue = todayTxns.reduce((s, t) => s + t.amount, 0);

  const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayTxns = paymentTxns.filter(t => new Date(t.created_at).toDateString() === yesterdayDate.toDateString());
  const yesterdayRevenue = yesterdayTxns.reduce((s, t) => s + t.amount, 0);
  const revenueDelta = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100) : (todayRevenue > 0 ? 100 : 0);

  const dowKeys = ["mdDowSun","mdDowMon","mdDowTue","mdDowWed","mdDowThu","mdDowFri","mdDowSat"] as const;
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toDateString();
    const dayTxns = paymentTxns.filter(t => new Date(t.created_at).toDateString() === dayStr);
    return { day: t(dowKeys[d.getDay()]), amount: dayTxns.reduce((s, t) => s + t.amount, 0), count: dayTxns.length };
  });
  const maxDay = Math.max(...last7.map(d => d.amount), 1);

  const hourCounts: number[] = Array(24).fill(0);
  paymentTxns.forEach(t => { hourCounts[new Date(t.created_at).getHours()]++; });
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const peakLabel = `${peakHour % 12 || 12}${peakHour < 12 ? "AM" : "PM"}`;

  const [qrGenerateLoading, setQrGenerateLoading] = useState(false);
  const [showQrGenerate, setShowQrGenerate] = useState(false);
  const [qrAmount, setQrAmount] = useState("");
  const [qrReference, setQrReference] = useState("");
  const [showQrPopup, setShowQrPopup] = useState(false);
  const [generatedQrDataUrl, setGeneratedQrDataUrl] = useState("");
  const [generatedQrLink, setGeneratedQrLink] = useState("");
  const [generatedQrAmount, setGeneratedQrAmount] = useState("");
  const [generatedQrRef, setGeneratedQrRef] = useState("");

  const handleGenerateQR = async () => {
    const amt = parseFloat(qrAmount);
    if (!merchant || !amt || amt < 1 || amt > 1000000) {
      toast({ title: t("mqrInvalidAmount"), description: t("mqrInvalidAmountDesc"), variant: "destructive" });
      return;
    }
    setQrGenerateLoading(true);
    try {
      const { data: keyData } = await supabase
        .from("merchant_api_keys")
        .select("api_key, app_password")
        .eq("merchant_id", merchant.id)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!keyData) {
        toast({ title: t("mqrNoApiKey"), description: t("mqrNoApiKeyDesc"), variant: "destructive" });
        setQrGenerateLoading(false);
        return;
      }

      const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merchant-payment-api`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": keyData.api_key,
          "X-App-Password": keyData.app_password || "",
        },
        body: JSON.stringify({
          action: "create_session",
          amount: amt,
          reference: qrReference.trim() || `QR-${Date.now().toString(36).toUpperCase()}`,
          description: `${t("mqrPayOf")} ৳${amt}`,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const qrPath = data.qr_page_url || `/pay/qr/${data.session_id}`;
      const fallbackBaseUrl = "https://pay-palooza-go.lovable.app";
      const normalizedUrl = typeof qrPath === "string" && qrPath.startsWith("http")
        ? qrPath.replace(/^https?:\/\/[^/]*lovableproject\.com/i, fallbackBaseUrl)
        : `${fallbackBaseUrl}${String(qrPath).startsWith("/") ? qrPath : `/${qrPath}`}`;
      const fullUrl = normalizedUrl;
      const qrDataUrl = await QRCode.toDataURL(fullUrl, { width: 300, margin: 2 });
      setGeneratedQrDataUrl(qrDataUrl);
      setGeneratedQrLink(fullUrl);
      setGeneratedQrAmount(`৳${amt}`);
      setGeneratedQrRef(qrReference.trim() || `QR-${Date.now().toString(36).toUpperCase()}`);
      setShowQrPopup(true);
      setShowQrGenerate(false);
      navigator.clipboard.writeText(fullUrl).then(() => {
        toast({ title: t("mqrLinkCopied"), description: t("mqrLinkCopiedDesc") });

      }).catch(() => {});
      setQrAmount("");
      setQrReference("");
    } catch (err: any) {
      toast({ title: t("mqrGenerationFailed"), description: err.message, variant: "destructive" });
    } finally {
      setQrGenerateLoading(false);
    }
  };

  const quickActions = [
    { icon: Send, label: t("mdSendMoney"), permission: "payouts", gradient: "from-blue-500 to-indigo-600", onClick: () => setShowSendMoney(true) },
    { icon: HandCoins, label: t("mdCashOut"), permission: "payouts", gradient: "from-emerald-500 to-teal-600", onClick: () => setShowCashOut(true) },
    { icon: Landmark, label: t("mdAddBank"), permission: "add_bank", gradient: "from-amber-500 to-orange-600", onClick: () => setShowAddBank(true) },
    { icon: CalendarClock, label: t("mdSettlement"), permission: "settlements", gradient: "from-purple-500 to-violet-600", onClick: () => setShowSettlementConfig(true) },
    
  ];

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-4">
      {/* Quick Actions Grid — Merchant Services (top of Overview) */}
      <motion.div variants={stagger.item}>
        <div className="flex items-center justify-between mb-2.5 px-1">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Zap size={14} className="text-primary" /> {t("mdMerchantServices")}
          </h3>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {quickActions.map(a => {
            const locked = isStaff && !can(a.permission);
            return (
              <motion.button
                key={a.label}
                whileTap={locked ? undefined : { scale: 0.95 }}
                onClick={() => locked
                  ? setRequestSheet({ label: a.label })
                  : a.onClick()}
                aria-disabled={locked}
                className={`flex flex-col items-center gap-1.5 p-2 sm:p-3 rounded-2xl bg-card shadow-card border border-border/40 transition-all min-w-0 ${locked ? "opacity-50 cursor-not-allowed" : "hover:shadow-elevated press-effect"}`}>
                <div className="relative">
                  <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br ${a.gradient} flex items-center justify-center shadow-sm`}>
                    <a.icon size={18} className="text-white" />
                  </div>
                  {locked && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-background border border-border/60 flex items-center justify-center shadow-sm">
                      <Lock size={9} className="text-muted-foreground" />
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-bold text-foreground leading-tight text-center break-words w-full">{a.label}</span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Today snapshot */}
      {merchant && (
        <motion.div variants={stagger.item} className="space-y-3">
          <MerchantTodaySnapshot merchantId={merchant.id} />
          <MerchantInventoryAlerts merchantId={merchant.id} threshold={5} />
          <MerchantWeeklyDigestCard merchantId={merchant.id} />
        </motion.div>
      )}


      {/* Dynamic QR Demo Card */}
      <motion.div variants={stagger.item}>
        <Card className="p-5 border-0 shadow-sm rounded-2xl bg-gradient-to-br from-primary/5 via-card to-primary/8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <QrCode size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[15px] font-bold text-foreground leading-tight">{t("mdDynamicQR")}</h4>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{t("mdDynamicQRDesc")}</p>
            </div>
            <Button
              size="sm"
              className="h-8 px-3 text-[11px] font-bold gap-2 shrink-0 rounded-full"
              onClick={() => setShowQrGenerate(true)}
            >
              <ScanLine size={14} />
              {t("mdGenerateQR")}
            </Button>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 size={15} className="text-primary" />
              </div>
              <h3 className="text-sm font-bold text-foreground">{t("mdLast7Days")}</h3>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">{(uniqueCustomers === 1 ? t("mdUniqueCustomer") : t("mdUniqueCustomers")).replace("{n}", String(uniqueCustomers))}</p>
          </div>
          <div className="flex items-end gap-1.5 h-20">
            {last7.map((d, i) => {
              const h = Math.max((d.amount / maxDay) * 100, 4);
              const isToday = i === 6;
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[8px] font-bold text-muted-foreground">{d.amount > 0 ? `৳${fmt(d.amount)}` : ""}</span>
                  <div className="w-full flex justify-center" style={{ height: "48px" }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ delay: i * 0.05, duration: 0.4, ease: "easeOut" }}
                      className={`w-full max-w-[28px] rounded-t-md ${isToday ? "bg-primary" : "bg-primary/25"}`}
                    />
                  </div>
                  <span className={`text-[9px] font-semibold ${isToday ? "text-primary" : "text-muted-foreground"}`}>{d.day}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={stagger.item} className="grid grid-cols-2 gap-3">
        {[
          { label: t("mdTotalRevenue"), value: `৳${fmt(totalRevenue)}`, icon: DollarSign, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600" },
          { label: t("mdMdrDeducted"), value: `৳${fmt(mdrDeducted)}`, icon: Percent, iconBg: "bg-red-500/10", iconColor: "text-red-500" },
          { label: t("mdNetEarnings"), value: `৳${fmt(totalRevenue - mdrDeducted)}`, icon: TrendingUp, iconBg: "bg-amber-500/10", iconColor: "text-amber-600" },
          { label: t("mdAvgTransaction"), value: `৳${fmt(avgTxn)}`, icon: Receipt, iconBg: "bg-blue-500/10", iconColor: "text-blue-600" },
        ].map(s => (
          <Card key={s.label} className="p-3.5 border-0 shadow-card hover:shadow-elevated transition-shadow">
            <div className={`w-9 h-9 rounded-xl ${s.iconBg} flex items-center justify-center mb-2.5`}>
              <s.icon size={17} className={s.iconColor} />
            </div>
            <p className="text-lg font-extrabold text-foreground leading-tight">{s.value}</p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{s.label}</p>
          </Card>
        ))}
      </motion.div>


      {/* Recent payments */}
      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">{t("mdRecentActivity")}</h3>
            <button onClick={onSeeAll} className="text-[10px] font-semibold text-primary hover:underline">{t("mdSeeAllShort")}</button>
          </div>
          {allTxns.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                <CreditCard className="w-7 h-7 text-muted-foreground" />
              </motion.div>
              <p className="text-sm font-semibold text-foreground">{t("mdNoActivity")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("mdTxWillAppear")}</p>
            </motion.div>
          ) : (
            <div className="space-y-1">
              {allTxns.slice(0, 5).map(tx => {
                const cfg = MERCH_TX_CONFIG[tx.type] || MERCH_TX_CONFIG.payment;
                const TxIcon = cfg.icon;
                const isIncoming = MERCHANT_INCOMING_TYPES.has(tx.type);
                return (
                  <button key={tx.id} onClick={() => setOverviewSelectedTx(tx)} className="w-full flex items-center justify-between py-2.5 px-2 rounded-xl hover:bg-muted/30 transition-colors text-left">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl ${cfg.iconBg} flex items-center justify-center`}>
                        <TxIcon size={15} className={cfg.iconColor} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground truncate max-w-[160px]">{getMerchTxHeadline(tx)}</p>
                        <p className="text-[9px] text-muted-foreground">{cfg.label}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-bold ${isIncoming ? "text-emerald-600" : "text-foreground"}`}>{isIncoming ? "+" : "−"}৳{fmt(tx.amount)}</p>
                      <p className="text-[9px] text-muted-foreground">{new Date(tx.created_at).toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Overview detail sheet */}
        <Sheet open={!!overviewSelectedTx} onOpenChange={(o) => { if (!o) setOverviewSelectedTx(null); }}>
          <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto px-5 pb-8">
            <SheetHeader>
              <SheetTitle>{overviewSelectedTx ? getMerchTxHeadline(overviewSelectedTx) : "Transaction"}</SheetTitle>
            </SheetHeader>
            {overviewSelectedTx && (() => {
              const tx = overviewSelectedTx;
              const cfg = MERCH_TX_CONFIG[tx.type] || MERCH_TX_CONFIG.payment;
              const TxIcon = cfg.icon;
              const isIncoming = MERCHANT_INCOMING_TYPES.has(tx.type);
              return (
                <div className="mt-4 space-y-5">
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-14 h-14 rounded-2xl ${cfg.iconBg} flex items-center justify-center`}>
                      <TxIcon size={24} className={cfg.iconColor} />
                    </div>
                    <p className={`text-2xl font-extrabold ${isIncoming ? "text-emerald-600" : "text-foreground"}`}>{isIncoming ? "+" : "−"}৳{fmt(tx.amount)}</p>
                    <Badge variant={tx.status === "completed" ? "default" : "secondary"} className="text-[10px]">{tx.status}</Badge>
                  </div>
                  <div className="space-y-2 text-xs">
                    {tx.short_id && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Transaction ID</span>
                        <button onClick={() => { navigator.clipboard.writeText(tx.short_id); }} className="flex items-center gap-1 font-mono text-foreground">
                          {tx.short_id} <Copy size={10} className="text-muted-foreground" />
                        </button>
                      </div>
                    )}
                    <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium">{cfg.label}</span></div>
                    {tx.recipient_name && <div className="flex justify-between"><span className="text-muted-foreground">{isIncoming ? "From" : "To"}</span><span className="font-medium">{tx.recipient_name}</span></div>}
                    {tx.recipient_phone && <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="font-medium">{tx.recipient_phone}</span></div>}
                    {tx.reference && <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-medium">{tx.reference}</span></div>}
                    <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{new Date(tx.created_at).toLocaleString("en-BD")}</span></div>
                    {tx.fee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span className="font-medium">৳{fmt(tx.fee)}</span></div>}
                    {tx.balance_after != null && <div className="flex justify-between"><span className="text-muted-foreground">Balance After</span><span className="font-medium">৳{fmt(tx.balance_after)}</span></div>}
                    {tx.description && <div className="flex justify-between"><span className="text-muted-foreground">Note</span><span className="font-medium">{tx.description}</span></div>}
                  </div>
                </div>
              );
            })()}
          </SheetContent>
        </Sheet>
      </motion.div>

      {/* Modals */}
      <MerchantSendMoneySheet open={showSendMoney} onClose={() => setShowSendMoney(false)} onSuccess={onRefresh} />
      <MerchantCashOutSheet open={showCashOut} onClose={() => setShowCashOut(false)} onSuccess={onRefresh} />
      <MerchantAddBankSheet open={showAddBank} onClose={() => setShowAddBank(false)} merchant={merchant} />
      <MerchantSettlementConfigSheet open={showSettlementConfig} onClose={() => setShowSettlementConfig(false)} merchant={merchant} />

      {/* Generate QR Sheet */}
      <Sheet open={showQrGenerate} onOpenChange={setShowQrGenerate}>
        <SheetContent side="bottom" className="z-[80] rounded-t-2xl" overlayClassName="z-[80]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <QrCode size={18} className="text-primary" /> {t("mqrSheetTitle")}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t("mqrAmountLabel")}</label>
              <Input
                type="number"
                placeholder={t("mqrAmountPh")}
                value={qrAmount}
                onChange={e => setQrAmount(e.target.value)}
                min={1}
                max={1000000}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t("mqrRefLabel")}</label>
              <Input
                placeholder={t("mqrRefPh")}
                value={qrReference}
                onChange={e => setQrReference(e.target.value)}
                maxLength={100}
              />
            </div>
            <Button
              className="w-full font-bold gap-2"
              onClick={handleGenerateQR}
              disabled={qrGenerateLoading || !qrAmount || parseFloat(qrAmount) < 1}
            >
              {qrGenerateLoading ? <RefreshCw size={15} className="animate-spin" /> : <ScanLine size={15} />}
              {t("mqrGenerateBtn")}
            </Button>
          </div>
        </SheetContent>

      </Sheet>

      {/* QR Code Popup */}
      <AnimatePresence>
        {showQrPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowQrPopup(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-xs bg-card/95 backdrop-blur-xl border border-border/50 rounded-3xl shadow-elevated p-6 space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-primary" /> {t("mqrPopupTitle")}
                </h3>

                <button onClick={() => setShowQrPopup(false)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                  <X size={14} className="text-muted-foreground" />
                </button>
              </div>

              {/* QR Image */}
              <div className="flex justify-center">
                <div className="bg-white rounded-2xl p-3 shadow-sm">
                  {generatedQrDataUrl && <img src={generatedQrDataUrl} alt="Payment QR" className="w-56 h-56" />}
                </div>
              </div>

              {/* Amount & Reference */}
              <div className="text-center space-y-1">
                <p className="text-2xl font-extrabold text-foreground tracking-tight">{generatedQrAmount}</p>
                {generatedQrRef && <p className="text-xs text-muted-foreground font-medium">{t("mqrRefPrefix")} {generatedQrRef}</p>}
              </div>

              {/* Copy Link Button */}
              <Button
                variant="outline"
                className="w-full gap-2 text-xs font-bold"
                onClick={() => {
                  navigator.clipboard.writeText(generatedQrLink).then(() => {
                    toast({ title: t("mqrLinkCopied"), description: t("mqrLinkCopiedDesc") });
                  }).catch(() => {});
                }}
              >
                <Copy size={13} /> {t("mqrCopyLinkBtn")}
              </Button>

              {/* Open in new tab */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-2 text-xs text-muted-foreground"
                onClick={() => window.open(generatedQrLink, "_blank")}
              >
                <ExternalLink size={13} /> {t("mqrOpenNewTab")}
              </Button>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <RequestAccessSheet
        open={!!requestSheet}
        onClose={() => setRequestSheet(null)}
        tileLabel={requestSheet?.label ?? null}
        merchantId={merchant?.id ?? null}
        staffId={staffId}
      />
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ── Analytics Tab ── */
const AnalyticsTab = ({ merchant, paymentTxns }: { merchant: MerchantInfo | null; paymentTxns: TxnRow[] }) => {
  const { getFeeLabel: getMerchFeeLabel } = useFeeConfig();
  const totalRevenue = paymentTxns.reduce((s, t) => s + t.amount, 0);
  const mdrDeducted = Math.round(totalRevenue * mdrFraction(merchant?.mdr_rate));
  const avgTxn = paymentTxns.length > 0 ? Math.round(totalRevenue / paymentTxns.length) : 0;
  const uniqueCustomers = new Set(paymentTxns.map(t => t.recipient_phone)).size;

  const todayTxns = paymentTxns.filter(t => new Date(t.created_at).toDateString() === new Date().toDateString());
  const todayRevenue = todayTxns.reduce((s, t) => s + t.amount, 0);

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toDateString();
    const dayTxns = paymentTxns.filter(t => new Date(t.created_at).toDateString() === dayStr);
    return { day: d.toLocaleDateString("en-BD", { weekday: "short" }), amount: dayTxns.reduce((s, t) => s + t.amount, 0), count: dayTxns.length };
  });
  const maxDay = Math.max(...last7.map(d => d.amount), 1);

  const hourCounts: number[] = Array(24).fill(0);
  paymentTxns.forEach(t => { hourCounts[new Date(t.created_at).getHours()]++; });
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const peakLabel = `${peakHour % 12 || 12}${peakHour < 12 ? "AM" : "PM"}`;

  // Top customers
  const customerMap = new Map<string, { name: string; total: number; count: number }>();
  paymentTxns.forEach(t => {
    const key = t.recipient_phone || "unknown";
    const existing = customerMap.get(key);
    if (existing) { existing.total += t.amount; existing.count++; }
    else { customerMap.set(key, { name: t.recipient_name || key, total: t.amount, count: 1 }); }
  });
  const topCustomers = Array.from(customerMap.values()).sort((a, b) => b.total - a.total).slice(0, 5);

  // Last 30 days weekly breakdown
  const last30Revenue = paymentTxns
    .filter(t => new Date(t.created_at) > new Date(Date.now() - 30 * 86400000))
    .reduce((s, t) => s + t.amount, 0);
  const prev30Revenue = paymentTxns
    .filter(t => { const d = new Date(t.created_at); return d > new Date(Date.now() - 60 * 86400000) && d <= new Date(Date.now() - 30 * 86400000); })
    .reduce((s, t) => s + t.amount, 0);
  const monthGrowth = prev30Revenue > 0 ? ((last30Revenue - prev30Revenue) / prev30Revenue * 100) : 0;

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-4">
      {/* Quick Insights */}
      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Target size={14} className="text-primary" /> Quick Insights
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2.5 rounded-xl bg-muted/40">
              <Users size={14} className="text-primary mx-auto mb-1" />
              <p className="text-sm font-bold text-foreground">{uniqueCustomers}</p>
              <p className="text-[9px] text-muted-foreground">Unique Customers</p>
            </div>
            <div className="text-center p-2.5 rounded-xl bg-muted/40">
              <Clock size={14} className="text-primary mx-auto mb-1" />
              <p className="text-sm font-bold text-foreground">{peakLabel}</p>
              <p className="text-[9px] text-muted-foreground">Peak Hour</p>
            </div>
            <div className="text-center p-2.5 rounded-xl bg-muted/40">
              <Award size={14} className="text-primary mx-auto mb-1" />
              <p className="text-sm font-bold text-foreground">{formatMdrPercent(merchant?.mdr_rate)}</p>
              <p className="text-[9px] text-muted-foreground">MDR Rate</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Revenue Summary Cards */}
      <motion.div variants={stagger.item} className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Revenue", value: `৳${fmt(totalRevenue)}`, icon: DollarSign, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600" },
          { label: "Today's Revenue", value: `৳${fmt(todayRevenue)}`, icon: TrendingUp, iconBg: "bg-amber-500/10", iconColor: "text-amber-600" },
          { label: "MDR Deducted", value: `৳${fmt(mdrDeducted)}`, icon: Percent, iconBg: "bg-destructive/10", iconColor: "text-destructive" },
          { label: "Avg Transaction", value: `৳${fmt(avgTxn)}`, icon: Receipt, iconBg: "bg-blue-500/10", iconColor: "text-blue-600" },
        ].map(s => (
          <Card key={s.label} className="p-3.5 border-0 shadow-card hover:shadow-elevated transition-shadow">
            <div className={`w-9 h-9 rounded-xl ${s.iconBg} flex items-center justify-center mb-2.5`}>
              <s.icon size={17} className={s.iconColor} />
            </div>
            <p className="text-lg font-extrabold text-foreground leading-tight">{s.value}</p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{s.label}</p>
          </Card>
        ))}
      </motion.div>

      {/* 30-day Growth */}
      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">30-Day Revenue</p>
              <p className="text-xl font-extrabold text-foreground mt-0.5">৳{fmt(last30Revenue)}</p>
            </div>
            <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold ${monthGrowth >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
              {monthGrowth >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {Math.abs(monthGrowth).toFixed(1)}%
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">vs previous 30 days</p>
        </Card>
      </motion.div>

      {/* 7-Day Revenue Chart */}
      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 size={14} className="text-primary" /> Last 7 Days Revenue
          </h3>
          <div className="flex items-end gap-2 h-32">
            {last7.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <p className="text-[8px] text-muted-foreground font-semibold">
                  {d.amount > 999 ? `${(d.amount / 1000).toFixed(0)}k` : d.amount > 0 ? `৳${d.amount}` : "—"}
                </p>
                <div className="w-full rounded-lg transition-all relative overflow-hidden" style={{
                  height: `${Math.max(6, (d.amount / maxDay) * 90)}px`,
                }}>
                  <div className="absolute inset-0 rounded-lg" style={{
                    background: i === 6 ? "linear-gradient(180deg, hsl(24 90% 55%), hsl(350 65% 38%))" : "hsl(var(--muted))"
                  }} />
                  {i === 6 && <div className="absolute inset-0 rounded-lg animate-pulse" style={{
                    background: "linear-gradient(180deg, hsl(24 90% 55% / 0.3), transparent)"
                  }} />}
                </div>
                <p className={`text-[9px] font-medium ${i === 6 ? "text-foreground font-bold" : "text-muted-foreground"}`}>{d.day}</p>
              </div>
            ))}
          </div>
          {/* daily txn counts */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-border/40">
            {last7.map((d, i) => (
              <div key={i} className="flex-1 text-center">
                <p className="text-[9px] font-bold text-muted-foreground">{d.count}</p>
                <p className="text-[7px] text-muted-foreground/60">txns</p>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Fee & Charges Summary */}
      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <CircleDollarSign size={14} className="text-primary" /> Fee & Charges
          </h3>
          <div className="space-y-2">
            {[
              { label: "Send Money to User", fee: getMerchFeeLabel("send") || "Flat ৳5", icon: Send, color: "text-blue-600", bg: "bg-blue-500/10" },
              { label: "Cash Out (Merchant)", fee: getMerchFeeLabel("cashout") || "1.15%", icon: HandCoins, color: "text-emerald-600", bg: "bg-emerald-500/10" },
              { label: "Bank Auto-Settlement", fee: getMerchFeeLabel("banktransfer") || "1.00%", icon: Landmark, color: "text-amber-600", bg: "bg-amber-500/10" },
              { label: "MDR on Payments", fee: formatMdrPercent(merchant?.mdr_rate), icon: Percent, color: "text-purple-600", bg: "bg-purple-500/10" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-muted/30 border border-border/30">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center`}>
                    <item.icon size={14} className={item.color} />
                  </div>
                  <span className="text-xs font-semibold text-foreground">{item.label}</span>
                </div>
                <Badge variant="secondary" className="text-[10px] font-bold">{item.fee}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Settlement Status */}
      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-5" style={{
            background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)"
          }} />
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Timer size={14} className="text-primary" /> Settlement Status
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Frequency</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{merchant?.settlement_frequency || "T+1"}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Bank Status</p>
              <p className="text-sm font-bold text-foreground mt-0.5 flex items-center gap-1">
                {merchant?.bank_name ? (<><CheckCircle2 size={12} className="text-emerald-500" /> Linked</>) : (<><Shield size={12} className="text-amber-500" /> Not Set</>)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Next Payout</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{new Date(Date.now() + 86400000).toLocaleDateString("en-BD", { month: "short", day: "numeric" })}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Pending</p>
              <p className="text-sm font-bold text-foreground mt-0.5">৳{fmt(todayRevenue)}</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Top Customers */}
      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Star size={14} className="text-primary" /> Top Customers
          </h3>
          {topCustomers.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                <Users className="w-7 h-7 text-muted-foreground" />
              </motion.div>
              <p className="text-sm font-semibold text-foreground">No customer data yet</p>
              <p className="text-xs text-muted-foreground mt-1">Customer insights will appear here</p>
            </motion.div>
          ) : (
            <div className="space-y-1.5">
              {topCustomers.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 px-2 rounded-xl hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                      #{i + 1}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground truncate max-w-[140px]">{c.name}</p>
                      <p className="text-[9px] text-muted-foreground">{c.count} transactions</p>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-foreground">৳{fmt(c.total)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      {/* Hourly Activity Heatmap */}
      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Clock size={14} className="text-primary" /> Hourly Activity
          </h3>
          <div className="grid grid-cols-12 gap-1">
            {hourCounts.map((count, h) => {
              const maxCount = Math.max(...hourCounts, 1);
              const intensity = count / maxCount;
              return (
                <div key={h} className="flex flex-col items-center gap-1">
                  <div
                    className="w-full aspect-square rounded-md transition-colors"
                    style={{
                      background: intensity > 0
                        ? `hsl(24 90% 50% / ${0.15 + intensity * 0.7})`
                        : "hsl(var(--muted) / 0.5)"
                    }}
                    title={`${h}:00 — ${count} txns`}
                  />
                  {h % 3 === 0 && <p className="text-[7px] text-muted-foreground">{h}</p>}
                </div>
              );
            })}
          </div>
          <p className="text-[9px] text-muted-foreground mt-2 text-center">Hours (0–23) • Darker = more transactions</p>
        </Card>
      </motion.div>
    </motion.div>
  );
};


const EASYPAY_LOGO_URL = "/icons/easypay-logo.webp";
const DEFAULT_QR_TAGLINE = "Pay Smart · Live Easy";
const QR_SUB_TAGLINE = "Instant • Secure • Rewarding";
const DEFAULT_BAND_START = "#ff6a1a";
const DEFAULT_BAND_END = "#c02a55";

const QRTab = ({ merchant, toast }: { merchant: MerchantInfo | null; toast: any }) => {
  const { t } = useI18n();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  const rawPayload = merchant?.qr_code_data || `MRC-${merchant?.id?.slice(0, 8) || "UNKNOWN"}`;
  const qrPayload = rawPayload.toUpperCase();
  const shopName = merchant?.business_name || "Merchant";
  const tagline = merchant?.qr_card_tagline || DEFAULT_QR_TAGLINE;
  const bandStart = merchant?.qr_card_band_color_start || DEFAULT_BAND_START;
  const bandEnd = merchant?.qr_card_band_color_end || DEFAULT_BAND_END;
  const shopLogo = merchant?.qr_card_logo_url || "";

  useEffect(() => {
    QRCode.toDataURL(qrPayload, {
      width: 480,
      margin: 2,
      color: { dark: "#0b0b1f", light: "#ffffff" },
      errorCorrectionLevel: "H",
    }).then(setQrDataUrl).catch(() => {});
  }, [qrPayload]);

  // Preload EasyPay logo as data URL for reliable print rendering across browsers
  useEffect(() => {
    fetch(EASYPAY_LOGO_URL)
      .then(r => r.blob())
      .then(b => new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = rej;
        fr.readAsDataURL(b);
      }))
      .then(setLogoDataUrl)
      .catch(() => setLogoDataUrl(null));
  }, []);

  const copyCode = () => {
    navigator.clipboard.writeText(qrPayload);
    toast({ title: t("mqrCopied"), description: t("mqrCopiedDesc") });
  };



  const handlePrint = () => {
    if (!qrDataUrl) return;
    const w = window.open("", "_blank", "width=800,height=1000");
    if (!w) return;
    const easypayLogo = logoDataUrl || EASYPAY_LOGO_URL;
    const shopLogoImg = shopLogo
      ? `<img src="${shopLogo}" alt="" style="width:34px;height:34px;object-fit:contain;border-radius:8px;background:#fff;padding:3px" />`
      : "";
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${shopName} — Payment QR</title>
      <style>
        /* Exact A6: 105mm x 148mm. Zero page margin so the card owns the sheet. */
        @page { size: 105mm 148mm; margin: 0; }
        html, body { width: 105mm; height: 148mm; margin: 0; padding: 0; background: #fff; }
        *, *::before, *::after {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          color-adjust: exact;
        }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; }
        .sheet {
          width: 105mm; height: 148mm;
          padding: 5mm;
          display: flex; align-items: stretch; justify-content: stretch;
        }
        .card {
          width: 100%; height: 100%;
          border-radius: 6mm;
          border: 0.6mm solid #0b0b1f;
          position: relative; overflow: hidden;
          background: linear-gradient(160deg,#fff 0%,#fff 55%,#fff5ee 100%);
          text-align: center;
          display: flex; flex-direction: column;
        }
        .band {
          height: 18mm;
          background: linear-gradient(135deg, ${bandStart}, ${bandEnd});
          color: #fff;
          display: flex; align-items: center; justify-content: center; gap: 3mm;
          font-weight: 800; letter-spacing: 1.2px; font-size: 3.2mm; text-transform: uppercase;
        }
        .band img.ep { height: 7mm; width: auto; filter: brightness(0) invert(1); opacity: .95; }
        .band .sep { width: 0.4mm; height: 6mm; background: rgba(255,255,255,.5); }
        .body {
          flex: 1;
          padding: 4mm 5mm 3mm;
          display: flex; flex-direction: column; align-items: center; justify-content: space-between;
        }
        .shop-row { display: flex; align-items: center; justify-content: center; gap: 2.5mm; }
        h1 { margin: 0; font-size: 5.2mm; color: #0b0b1f; letter-spacing: .2px; line-height: 1.1; }
        .tag { margin: 1mm 0 0; font-size: 3mm; color: ${bandEnd}; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; }
        .qr-wrap { padding: 3mm; border-radius: 5mm; background: #fff; border: 0.4mm dashed rgba(11,11,31,.2); display: inline-block; }
        .qr-wrap img { width: 55mm; height: 55mm; display: block; }
        .mid {
          display: inline-block;
          padding: 2mm 5mm;
          border-radius: 20mm;
          background: #0b0b1f; color: #fff;
          font-family: 'SFMono-Regular', Menlo, monospace;
          font-weight: 700; letter-spacing: 1.5px; font-size: 3.4mm;
          text-transform: uppercase;
        }
        .foot { font-size: 2.6mm; color: #6b6b7b; letter-spacing: 1px; text-transform: uppercase; }
        .brand-row {
          display: flex; align-items: center; justify-content: center; gap: 2mm;
          font-size: 2.6mm; color: #0b0b1f; font-weight: 800; letter-spacing: 1.4px;
        }
        .brand-row img { height: 4mm; width: auto; }
      </style></head><body>
      <div class="sheet">
        <div class="card">
          <div class="band">
            <img class="ep" src="${easypayLogo}" alt="EasyPay"/>
            <span class="sep"></span>
            <span>Accepted Here</span>
          </div>
          <div class="body">
            <div>
              <div class="shop-row">${shopLogoImg}<h1>${shopName}</h1></div>
              <p class="tag">${tagline}</p>
              <p class="tag" style="font-size:2.4mm;letter-spacing:1.2mm;opacity:.7;margin-top:1mm">${QR_SUB_TAGLINE}</p>
            </div>
            <div class="qr-wrap"><img src="${qrDataUrl}" alt="QR"/></div>
            <div>
              <div class="mid">${qrPayload}</div>
              <div class="foot" style="margin-top:1.5mm">Scan with any EasyPay app</div>
            </div>
            <div class="brand-row">
              <span>powered by</span>
              <img src="${easypayLogo}" alt="EasyPay" style="filter:none"/>
            </div>
          </div>
        </div>
      </div>
      <script>
        (function(){
          function go(){ try { window.focus(); window.print(); } catch(e){} }
          if (document.readyState === 'complete') setTimeout(go, 200);
          else window.addEventListener('load', function(){ setTimeout(go, 200); });
        })();
      </script>
      </body></html>`);
    w.document.close();
  };

  const [pdfBusy, setPdfBusy] = useState(false);
  const handleDownloadPdf = async () => {
    if (!qrDataUrl) return;
    try {
      setPdfBusy(true);
      const { jsPDF } = await import("jspdf");
      // Exact A6 portrait: 105 x 148 mm
      const doc = new jsPDF({ unit: "mm", format: "a6", orientation: "portrait" });
      const W = 105, H = 148;
      const M = 5; // internal margin
      const cardX = M, cardY = M, cardW = W - 2 * M, cardH = H - 2 * M;

      const hexToRgb = (hex: string) => {
        const m = hex.replace("#", "");
        const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
        return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)] as [number, number, number];
      };
      const [br1, bg1, bb1] = hexToRgb(bandStart);
      const [br2, bg2, bb2] = hexToRgb(bandEnd);

      // Card border
      doc.setDrawColor(11, 11, 31);
      doc.setLineWidth(0.6);
      doc.roundedRect(cardX, cardY, cardW, cardH, 6, 6, "S");

      // Band (approx gradient using vertical strips)
      const bandH = 18;
      const strips = 60;
      for (let i = 0; i < strips; i++) {
        const t = i / (strips - 1);
        const r = Math.round(br1 + (br2 - br1) * t);
        const g = Math.round(bg1 + (bg2 - bg1) * t);
        const b = Math.round(bb1 + (bb2 - bb1) * t);
        doc.setFillColor(r, g, b);
        doc.rect(cardX + (cardW * i) / strips, cardY, cardW / strips + 0.2, bandH, "F");
      }

      // EasyPay logo + Accepted Here (inside band)
      if (logoDataUrl) {
        try { doc.addImage(logoDataUrl, "PNG", cardX + cardW / 2 - 16, cardY + 5, 8, 8, undefined, "FAST"); } catch {}
      }
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("EASYPAY  •  ACCEPTED HERE", cardX + cardW / 2 + (logoDataUrl ? 2 : -8), cardY + bandH / 2 + 1.2, { align: "center" });

      // Shop name
      let y = cardY + bandH + 8;
      doc.setTextColor(11, 11, 31);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(shopName, W / 2, y, { align: "center" });

      // Tagline
      y += 5;
      doc.setTextColor(br2, bg2, bb2);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(tagline.toUpperCase(), W / 2, y, { align: "center" });

      y += 4;
      doc.setTextColor(120, 120, 130);
      doc.setFontSize(7);
      doc.text(QR_SUB_TAGLINE.toUpperCase(), W / 2, y, { align: "center" });

      // QR
      const qrSize = 55;
      const qrX = W / 2 - qrSize / 2;
      const qrY = y + 5;
      // white pad with dashed border-ish frame
      doc.setDrawColor(180, 180, 190);
      doc.setLineWidth(0.3);
      doc.roundedRect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, 3, 3, "S");
      try { doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize, undefined, "FAST"); } catch {}

      // Merchant ID pill
      const midY = qrY + qrSize + 9;
      doc.setFillColor(11, 11, 31);
      const pillW = Math.min(cardW - 10, doc.getTextWidth(qrPayload) * 1.1 + 14);
      const pillX = W / 2 - pillW / 2;
      doc.roundedRect(pillX, midY - 4.5, pillW, 7, 3.5, 3.5, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("courier", "bold");
      doc.setFontSize(10);
      doc.text(qrPayload, W / 2, midY, { align: "center" });

      // Foot
      doc.setTextColor(120, 120, 130);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("SCAN WITH ANY EASYPAY APP", W / 2, midY + 6, { align: "center" });

      // Powered by
      doc.setTextColor(11, 11, 31);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      const footY = cardY + cardH - 4;
      doc.text("POWERED BY EASYPAY", W / 2, footY, { align: "center" });

      const safeName = shopName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "merchant";
      doc.save(`${safeName}-qr-a6.pdf`);
      toast({ title: t("mqrDownloaded"), description: t("mqrDownloadedDesc") });
    } catch (e: any) {
      toast({ title: t("mqrPdfFailed"), description: e?.message || t("mqrPdfFailedDesc"), variant: "destructive" });

    } finally {
      setPdfBusy(false);
    }
  };


  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={stagger.item}>
        <Card id="merchant-qr-card" className="p-0 border-0 shadow-elevated relative overflow-hidden rounded-3xl">
          {/* Premium gradient band (dynamic colors) */}
          <div className="relative px-6 pt-6 pb-4 text-center overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${bandStart} 0%, ${bandEnd} 100%)` }}>
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-20 -left-16 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm mb-2">
                <img src={EASYPAY_LOGO_URL} alt="EasyPay" className="h-3.5 w-auto object-contain brightness-0 invert" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">{t("mqrAcceptedHere")}</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                {shopLogo && (
                  <img src={shopLogo} alt="" className="h-6 w-6 rounded-md object-contain bg-white/90 p-0.5" />
                )}
                <h3 className="text-lg font-black text-white tracking-tight">{shopName}</h3>
              </div>
              <p className="text-[13px] font-bold text-white mt-1 tracking-tight">{tagline}</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-white/80 mt-0.5">{QR_SUB_TAGLINE}</p>
            </div>
          </div>


          {/* QR Body */}
          <div className="px-6 pt-6 pb-6 text-center bg-card">
            {qrDataUrl ? (
              <div className="relative inline-block mb-5">
                <div className="absolute inset-0 rounded-3xl blur-xl opacity-30"
                  style={{ background: "linear-gradient(135deg, hsl(24 95% 55%), hsl(350 75% 45%))" }} />
                <div className="relative p-4 bg-white rounded-3xl shadow-elevated ring-1 ring-border/20">
                  <img src={qrDataUrl} alt="Merchant QR" className="w-52 h-52" />
                  {/* Corner brackets */}
                  <span className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                  <span className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                  <span className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                  <span className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-primary rounded-br-lg" />
                </div>
              </div>
            ) : (
              <div className="w-56 h-56 mx-auto bg-muted rounded-3xl flex items-center justify-center mb-5">
                <QrCode size={48} className="text-muted-foreground" />
              </div>
            )}

            <div className="flex items-center justify-center gap-2 mb-5">
              <code className="text-xs font-mono font-bold tracking-[0.2em] px-4 py-2 rounded-xl text-foreground uppercase"
                style={{ background: "linear-gradient(135deg, hsl(var(--muted)), hsl(var(--muted)/0.6))" }}>
                {qrPayload}
              </code>
              <button onClick={copyCode} className="tap-target text-muted-foreground hover:text-primary transition-colors">
                <Copy size={14} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" className="rounded-xl h-11" onClick={async () => {
                const shareText = t("mqrPayVia").replace("{name}", shopName).replace("{id}", qrPayload);
                const shareUrl = `${window.location.origin}/pay?merchant=${encodeURIComponent(qrPayload)}`;
                let file: File | null = null;
                // Snapshot the full branded card (matches what the merchant sees)
                try {
                  const card = document.getElementById("merchant-qr-card");
                  if (card) {
                    const { default: html2canvas } = await import("html2canvas");
                    const canvas = await html2canvas(card, { backgroundColor: "#ffffff", scale: 3, useCORS: true, logging: false });
                    const blob: Blob | null = await new Promise((r) => canvas.toBlob((b) => r(b), "image/png", 1));
                    if (blob) file = new File([blob], `${shopName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "merchant"}-qr.png`, { type: "image/png" });
                  }
                } catch {}
                // Fallback to raw QR if card capture failed
                if (!file && qrDataUrl) {
                  try {
                    const res = await fetch(qrDataUrl);
                    const blob = await res.blob();
                    file = new File([blob], "payment-qr.png", { type: "image/png" });
                  } catch {}
                }
                const baseData: ShareData = { title: t("mqrPayTitle").replace("{name}", shopName), text: shareText, url: shareUrl };
                const withFile: ShareData = file ? { ...baseData, files: [file] } : baseData;
                // iOS Safari: canShare must be called with the FULL payload (files+text+url together)
                try {
                  if (navigator.share && file && navigator.canShare?.(withFile)) {
                    await navigator.share(withFile);
                    return;
                  }
                  if (navigator.share && navigator.canShare?.(baseData)) {
                    await navigator.share(baseData);
                    return;
                  }
                  if (navigator.share) {
                    await navigator.share(baseData);
                    return;
                  }
                } catch (e: any) {
                  if (e?.name === "AbortError") return;
                }
                try {
                  await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
                  toast({ title: t("mqrCopied"), description: t("mqrShareCopiedDesc") });
                } catch {
                  toast({ title: t("mqrShareUnavailable"), description: t("mqrShareUnavailableDesc"), variant: "destructive" });
                }
              }}>
                <Share2 size={14} className="mr-1" /> <span className="text-xs">{t("mqrShare")}</span>
              </Button>
              <Button variant="outline" className="rounded-xl h-11" onClick={handlePrint}>
                <Receipt size={14} className="mr-1" /> <span className="text-xs">{t("mqrPrint")}</span>
              </Button>
              <Button variant="outline" className="rounded-xl h-11" onClick={copyCode}>
                <Copy size={14} className="mr-1" /> <span className="text-xs">{t("mqrCopy")}</span>
              </Button>

            </div>

          </div>
        </Card>
      </motion.div>

      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3">{t("mqrDetails")}</h3>
          <div className="space-y-2 text-xs">
            {[
              { label: t("mqrRowMerchantId"), value: qrPayload },
              { label: t("mqrRowBusiness"), value: merchant?.business_name || "—" },
              { label: t("mqrRowCategory"), value: merchant?.category || "—" },
              { label: t("mqrRowMdr"), value: formatMdrPercent(merchant?.mdr_rate) },
              { label: t("mqrRowTradeLicense"), value: merchant?.trade_license || "—" },

            ].map(r => (
              <div key={r.label} className="flex justify-between py-2 border-b border-border/50 last:border-0">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-semibold text-foreground capitalize">{r.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

    </motion.div>
  );
};


/* ── Transactions Tab ── */
const TxnTab = ({ txns, merchant }: { txns: TxnRow[]; merchant: MerchantInfo | null }) => {
  const { t, lang } = useI18n();
  const localeTag = lang === "bn" ? "bn-BD" : "en-BD";
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedTx, setSelectedTx] = useState<TxnRow | null>(null);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const [filterMode, setFilterMode] = useState<"month" | "range">("month");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [searchQuery, setSearchQuery] = useState("");

  const targetMonth = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const filtered = useMemo(() => {
    let list = txns;
    if (filterMode === "month") {
      const start = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
      const end = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59, 999);
      list = list.filter(t => { const d = new Date(t.created_at); return d >= start && d <= end; });
    } else if (dateRange.from && dateRange.to) {
      const endOfDay = new Date(dateRange.to);
      endOfDay.setHours(23, 59, 59, 999);
      list = list.filter(t => {
        const d = new Date(t.created_at);
        return isWithinInterval(d, { start: dateRange.from!, end: endOfDay });
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t =>
        t.recipient_name?.toLowerCase().includes(q) ||
        t.recipient_phone?.includes(q) ||
        t.reference?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.short_id?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [txns, targetMonth, filterMode, dateRange, searchQuery]);

  const summary = useMemo(() => {
    let incoming = 0, outgoing = 0;
    for (const t of filtered) {
      if (MERCHANT_INCOMING_TYPES.has(t.type)) incoming += t.amount;
      else outgoing += t.amount;
    }
    return { count: filtered.length, incoming, outgoing };
  }, [filtered]);

  const monthLabel = targetMonth.toLocaleDateString(localeTag, { month: "long", year: "numeric" });

  const exportLabel = filterMode === "range" && dateRange.from && dateRange.to
    ? `Statement_${format(dateRange.from, "yyyy-MM-dd")}_to_${format(dateRange.to, "yyyy-MM-dd")}`
    : `Statement_${monthLabel.replace(/ /g, "_")}`;

  const copyId = (val: string) => {
    navigator.clipboard.writeText(val);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const exportCSV = () => {
    if (filtered.length === 0) { toast({ title: t("mhToastNoData") }); return; }

    const headers = ["ID", "Type", "Description", "Amount", "Fee", "Status", "Date", "Phone", "Reference"];
    const rows = filtered.map(tx => [
      tx.short_id || tx.id.slice(0, 12),
      (MERCH_TX_CONFIG[tx.type] || MERCH_TX_CONFIG.payment).label,
      getMerchTxHeadline(tx),
      String(tx.amount),
      String(tx.fee),
      tx.status,
      new Date(tx.created_at).toLocaleString("en-BD"),
      tx.recipient_phone || "",
      tx.reference || "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${exportLabel}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    if (filtered.length === 0) { toast({ title: t("mhToastNoData") }); return; }
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const ml = 15;
    const mr = pw - 15;
    const BR = { r: 14, g: 165, b: 100 };
    const GBG = { r: 248, g: 249, b: 250 };
    const DK = { r: 30, g: 30, b: 30 };
    const MD = { r: 120, g: 120, b: 120 };
    const LT = { r: 180, g: 180, b: 180 };

    // Fetch merchant application for address details
    let appData: { owner_name?: string; business_address?: string; contact_number?: string; contact_email?: string } = {};
    try {
      const { data: merchRow } = await supabase.from("merchants").select("user_id").eq("id", merchant?.id || "").single();
      if (merchRow?.user_id) {
        const { data } = await supabase.from("merchant_applications").select("owner_name, business_address, contact_number, contact_email").eq("user_id", merchRow.user_id).eq("status", "approved").order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (data) appData = data;
      }
    } catch { /* skip */ }

    // Load logo
    let logo: string | null = null;
    try {
      const res = await fetch("/icons/easypay-logo.webp");
      const blob = await res.blob();
      logo = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch { /* skip */ }

    // ── Accent strip ──
    doc.setFillColor(BR.r, BR.g, BR.b);
    doc.rect(0, 0, pw, 5, "F");

    // ── Logo + Company ──
    if (logo) { try { doc.addImage(logo, "PNG", ml, 10, 12, 12); } catch { /* skip */ } }
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(BR.r, BR.g, BR.b);
    doc.text("EasyPay", ml, 26);
    const epW = doc.getTextWidth("EasyPay ");
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(MD.r, MD.g, MD.b);
    doc.text("Digital Financial Services", ml + epW, 26);
    doc.text("Dhaka, Bangladesh", ml, 30);

    // ── Title + Meta (right) ──
    doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(BR.r, BR.g, BR.b);
    doc.text("ACCOUNT STATEMENT", mr, 16, { align: "right" });
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(DK.r, DK.g, DK.b);
    const periodText = filterMode === "range" && dateRange.from && dateRange.to
      ? `${format(dateRange.from, "dd MMM yyyy")} – ${format(dateRange.to, "dd MMM yyyy")}`
      : monthLabel;
    doc.text(`Period: ${periodText}`, mr, 22, { align: "right" });
    doc.text(`Generated: ${format(new Date(), "dd MMM yyyy")}`, mr, 27, { align: "right" });

    // ── Green separator ──
    let y = 36;
    doc.setDrawColor(BR.r, BR.g, BR.b); doc.setLineWidth(0.6);
    doc.line(ml, y, mr, y);
    y += 6;

    // ── Account Info Block (with full address) ──
    const infoLines: string[] = [];
    if (appData.owner_name) infoLines.push(appData.owner_name);
    if (appData.business_address) infoLines.push(appData.business_address);
    if (appData.contact_number) infoLines.push(appData.contact_number);
    if (appData.contact_email) infoLines.push(appData.contact_email);
    const infoBoxH = 14 + infoLines.length * 4.5;
    doc.setFillColor(GBG.r, GBG.g, GBG.b);
    doc.roundedRect(ml, y, mr - ml, infoBoxH, 2, 2, "F");
    doc.setFontSize(7); doc.setTextColor(MD.r, MD.g, MD.b);
    doc.text("ACCOUNT HOLDER", ml + 5, y + 5);
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(DK.r, DK.g, DK.b);
    doc.text(merchant?.business_name || "Merchant", ml + 5, y + 11);
    let infoY = y + 16;
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(MD.r, MD.g, MD.b);
    infoLines.forEach(line => {
      doc.text(line, ml + 5, infoY);
      infoY += 4.5;
    });
    y += infoBoxH + 6;

    // ── Summary Grid (4 cells) ──
    const cellW = (mr - ml - 9) / 4;
    const net = summary.incoming - summary.outgoing;
    const summaryData = [
      { label: "Transactions", value: String(summary.count) },
      { label: "Incoming", value: `Tk ${fmt(summary.incoming)}` },
      { label: "Outgoing", value: `Tk ${fmt(summary.outgoing)}` },
      { label: "Net Balance", value: `Tk ${fmt(net)}` },
    ];
    summaryData.forEach((cell, i) => {
      const cx = ml + i * (cellW + 3);
      doc.setFillColor(GBG.r, GBG.g, GBG.b);
      doc.roundedRect(cx, y, cellW, 16, 1.5, 1.5, "F");
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(MD.r, MD.g, MD.b);
      doc.text(cell.label, cx + cellW / 2, y + 5, { align: "center" });
      doc.setFontSize(10); doc.setFont("helvetica", "bold");
      if (cell.label === "Net Balance") {
        doc.setTextColor(net >= 0 ? BR.r : 200, net >= 0 ? BR.g : 50, net >= 0 ? BR.b : 50);
      } else {
        doc.setTextColor(DK.r, DK.g, DK.b);
      }
      doc.text(cell.value, cx + cellW / 2, y + 12, { align: "center" });
    });
    y += 24;

    // ── Transaction Table ──
    autoTable(doc, {
      startY: y,
      margin: { left: ml, right: 15 },
      head: [["Date", "Type", "Description", "Amount", "Fee", "Status"]],
      body: filtered.map(tx => {
        const isIn = MERCHANT_INCOMING_TYPES.has(tx.type);
        return [
          format(new Date(tx.created_at), "dd MMM yyyy"),
          (MERCH_TX_CONFIG[tx.type] || MERCH_TX_CONFIG.payment).label,
          getMerchTxHeadline(tx),
          `${isIn ? "+" : "-"}Tk ${fmt(tx.amount)}`,
          tx.fee > 0 ? `Tk ${fmt(tx.fee)}` : "—",
          tx.status,
        ];
      }),
      theme: "grid",
      headStyles: { fillColor: [BR.r, BR.g, BR.b], textColor: 255, fontStyle: "bold", fontSize: 8, cellPadding: 2.5 },
      bodyStyles: { fontSize: 8, textColor: [DK.r, DK.g, DK.b], cellPadding: 2.5, lineColor: [230, 230, 230], lineWidth: 0.3 },
      alternateRowStyles: { fillColor: [GBG.r, GBG.g, GBG.b] },
      columnStyles: {
        3: { halign: "right" },
        4: { halign: "right" },
      },
    });

    // ── Footer on every page ──
    const pages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      const fy = ph - 18;
      doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.3);
      doc.line(ml, fy, mr, fy);
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(LT.r, LT.g, LT.b);
      doc.text("This is a computer-generated statement and does not require a signature.", pw / 2, fy + 4, { align: "center" });
      doc.text("EasyPay Digital Financial Services · Dhaka, Bangladesh", pw / 2, fy + 8, { align: "center" });
      doc.text(`Page ${i} of ${pages}`, pw / 2, fy + 12, { align: "center" });
    }

    doc.save(`${exportLabel}.pdf`);
  };

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-4">
      {/* Filter controls */}
      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          {/* Mode toggle */}
          <div className="flex items-center gap-1.5 mb-3">
            <div className="flex bg-muted p-0.5 rounded-lg">
              <button onClick={() => setFilterMode("month")} className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${filterMode === "month" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <Calendar size={12} className="inline mr-1 -mt-0.5" />{t("mhMonthly")}
              </button>
              <button onClick={() => setFilterMode("range")} className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${filterMode === "range" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <CalendarClock size={12} className="inline mr-1 -mt-0.5" />{t("mhCustomRange")}
              </button>

            </div>
            <div className="relative ml-auto w-[42%] min-w-[110px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t("mhSearchPh")}
                className="pl-8 h-8 text-xs rounded-full bg-background"
              />
            </div>
          </div>

          {filterMode === "month" ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setMonthOffset(o => o - 1)}>
                  <ChevronLeft size={16} />
                </Button>
                <span className="text-sm font-bold text-foreground">{monthLabel}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" disabled={monthOffset >= 0} onClick={() => setMonthOffset(o => o + 1)}>
                  <ChevronRight size={16} />
                </Button>
              </div>
              <div className="flex gap-1.5 justify-center mb-3">
                <button onClick={() => setMonthOffset(0)} className={`px-3 py-1 rounded-lg text-[10px] font-semibold transition-colors ${monthOffset === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{t("mhThisMonth")}</button>
                <button onClick={() => setMonthOffset(-1)} className={`px-3 py-1 rounded-lg text-[10px] font-semibold transition-colors ${monthOffset === -1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{t("mhLastMonth")}</button>

              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={`w-full justify-start text-left text-xs font-normal h-9 ${!dateRange.from && "text-muted-foreground"}`}>
                    <Calendar size={13} className="mr-1.5 shrink-0" />
                    {dateRange.from ? format(dateRange.from, "dd MMM yyyy") : t("mhFromDate")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[100]" align="start">
                  <CalendarPicker mode="single" selected={dateRange.from} onSelect={(d) => setDateRange(prev => ({ ...prev, from: d }))} disabled={(d) => d > new Date()} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={`w-full justify-start text-left text-xs font-normal h-9 ${!dateRange.to && "text-muted-foreground"}`}>
                    <Calendar size={13} className="mr-1.5 shrink-0" />
                    {dateRange.to ? format(dateRange.to, "dd MMM yyyy") : t("mhToDate")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[100]" align="start">
                  <CalendarPicker mode="single" selected={dateRange.to} onSelect={(d) => setDateRange(prev => ({ ...prev, to: d }))} disabled={(d) => d > new Date() || (dateRange.from ? d < dateRange.from : false)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              {(dateRange.from || dateRange.to) && (
                <Button variant="ghost" size="sm" className="col-span-2 text-xs text-muted-foreground h-7" onClick={() => setDateRange({ from: undefined, to: undefined })}>
                  <X size={12} className="mr-1" /> {t("mhClearDates")}
                </Button>
              )}
            </div>
          )}


          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-muted/40 rounded-xl p-2.5 text-center">
              <p className="text-sm font-bold text-foreground">{summary.count}</p>
              <p className="text-[9px] text-muted-foreground font-medium">{t("mhTransactionsLabel")}</p>
            </div>
            <div className="bg-emerald-500/10 rounded-xl p-2.5 text-center">
              <p className="text-sm font-bold text-emerald-600">৳{fmt(summary.incoming)}</p>
              <p className="text-[9px] text-muted-foreground font-medium">{t("mhIncoming")}</p>
            </div>
            <div className="bg-pink-500/10 rounded-xl p-2.5 text-center">
              <p className="text-sm font-bold text-pink-600">৳{fmt(summary.outgoing)}</p>
              <p className="text-[9px] text-muted-foreground font-medium">{t("mhOutgoing")}</p>

            </div>
          </div>

          {/* Export buttons */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5" onClick={exportPDF}>
              <Download size={13} /> {t("mhPdfStatement")}
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5" onClick={exportCSV}>
              <Download size={13} /> {t("mhCsvExport")}
            </Button>

          </div>
        </Card>
      </motion.div>

      {/* Transaction list */}
      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3">{t("mhTransactionsTitle")}</h3>

          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex flex-col items-center justify-center py-10 text-center"
            >
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3"
              >
                <Receipt size={28} className="text-muted-foreground" />
              </motion.div>
              <p className="text-sm font-semibold text-foreground">{t("mhNoTxnFound")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery ? t("mhTrySearch") : t("mhTryPeriod")}
              </p>

            </motion.div>
          ) : (
            <div className="space-y-1">
              {filtered.map(tx => {
                const isIncoming = MERCHANT_INCOMING_TYPES.has(tx.type);
                const cfg = MERCH_TX_CONFIG[tx.type] || MERCH_TX_CONFIG.payment;
                const TxIcon = cfg.icon;
                const headline = getMerchTxHeadline(tx);

                return (
                  <button key={tx.id} onClick={() => setSelectedTx(tx)} className="w-full flex items-center justify-between py-2.5 px-2.5 rounded-xl hover:bg-muted/30 transition-colors text-left">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-9 h-9 rounded-xl ${cfg.iconBg} flex items-center justify-center shrink-0`}>
                        <TxIcon size={14} className={cfg.iconColor} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground truncate">{headline}</p>
                        <div className="flex items-center gap-1">
                          <p className="text-[9px] text-muted-foreground">{cfg.label} · {tx.recipient_phone || "—"}</p>
                        </div>
                        {tx.status === "pending" && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 mt-0.5">
                            <Clock size={9} /> {t("mhPending")}
                          </span>
                        )}
                        {tx.status === "failed" && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-destructive/10 text-destructive mt-0.5">
                            <AlertTriangle size={9} /> {t("mhFailed")}

                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2 shrink-0">
                      <div>
                        <p className={`text-xs font-bold ${isIncoming ? "text-emerald-600" : "text-foreground"}`}>
                          {isIncoming ? "+" : "−"}৳{fmt(tx.amount)}
                        </p>
                        <p className="text-[9px] text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString(localeTag, { month: "short", day: "numeric" })}
                          {" "}
                          {new Date(tx.created_at).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" })}

                        </p>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </motion.div>

      {/* Transaction Detail Sheet */}
      <Sheet open={!!selectedTx} onOpenChange={o => { if (!o) setSelectedTx(null); }}>
        <SheetContent side="bottom" className="z-[80] rounded-t-3xl px-5 pb-8 pt-2 max-h-[85vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base font-bold text-foreground">{t("mhTxnDetails")}</SheetTitle>
          </SheetHeader>
          {selectedTx && (() => {
            const isIncoming = MERCHANT_INCOMING_TYPES.has(selectedTx.type);
            const cfg = MERCH_TX_CONFIG[selectedTx.type] || MERCH_TX_CONFIG.payment;
            const TxIcon = cfg.icon;
            const headline = getMerchTxHeadline(selectedTx);
            const txId = selectedTx.short_id || selectedTx.id.slice(0, 12).toUpperCase();

            return (
              <div className="space-y-4">
                <div className="flex flex-col items-center py-3">
                  <div className={`w-14 h-14 rounded-2xl ${cfg.iconBg} flex items-center justify-center mb-3`}>
                    <TxIcon size={22} className={cfg.iconColor} />
                  </div>
                  <p className={`text-3xl font-black ${isIncoming ? "text-emerald-600" : "text-foreground"}`}>
                    {isIncoming ? "+" : "−"}৳{fmt(selectedTx.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{headline}</p>
                  <Badge variant="outline" className="mt-2 text-[10px] capitalize">{selectedTx.status}</Badge>
                </div>

                <div className="bg-muted/40 rounded-2xl p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("mhTxnId")}</span>
                    <button onClick={() => copyId(selectedTx.short_id || selectedTx.id)} className="flex items-center gap-1 font-mono font-semibold text-foreground">
                      {txId} {copied ? <CheckCircle2 size={11} className="text-primary" /> : <Copy size={11} className="text-muted-foreground" />}
                    </button>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("mhType")}</span>
                    <span className="font-semibold text-foreground">{cfg.label}</span>
                  </div>
                  {selectedTx.recipient_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{isIncoming ? t("mhFrom") : t("mhTo")}</span>
                      <span className="font-semibold text-foreground">{selectedTx.recipient_name}</span>
                    </div>
                  )}
                  {selectedTx.recipient_phone && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("mhPhone")}</span>
                      <span className="font-semibold text-foreground">{selectedTx.recipient_phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("mhDate")}</span>
                    <span className="font-semibold text-foreground">{new Date(selectedTx.created_at).toLocaleString(localeTag, { dateStyle: "medium", timeStyle: "short" })}</span>
                  </div>
                  {selectedTx.reference && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{t("mhReference")}</span>
                      <button onClick={() => copyId(selectedTx.reference!)} className="flex items-center gap-1 font-mono font-semibold text-foreground">
                        {selectedTx.reference} <Copy size={11} className="text-muted-foreground" />
                      </button>
                    </div>
                  )}

                </div>

                {selectedTx.fee > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-200 dark:border-amber-800 space-y-2 text-xs">
                    <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">{t("mhFeeBreakdown")}</p>
                    <div className="flex justify-between">
                      <span className="text-amber-800 dark:text-amber-300">{t("mhPrincipal")}</span>
                      <span className="font-semibold text-amber-900 dark:text-amber-200">৳{fmt(selectedTx.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-800 dark:text-amber-300">{t("mhFee")}</span>
                      <span className="font-semibold text-amber-900 dark:text-amber-200">৳{fmt(selectedTx.fee)}</span>
                    </div>
                    <div className="border-t border-amber-300 dark:border-amber-700 pt-2 flex justify-between font-bold">
                      <span className="text-amber-900 dark:text-amber-100">{t("mhTotal")}</span>
                      <span className="text-amber-900 dark:text-amber-100">৳{fmt(selectedTx.amount + selectedTx.fee)}</span>
                    </div>

                  </div>
                )}

                {selectedTx.balance_after !== null && (
                  <div className="text-center text-[11px] text-muted-foreground">
                    {t("mhBalanceAfter")} <span className="font-bold text-foreground">৳{fmt(selectedTx.balance_after)}</span>
                  </div>
                )}
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
};

/* ── Settlement Tab ── */
const SettlementTab = ({ merchant, paymentTxns }: { merchant: MerchantInfo | null; paymentTxns: TxnRow[] }) => {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [period, setPeriod] = useState<"7" | "30" | "all">("30");
  const fmtN = (n: number) => new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-BD").format(n);
  const localeDate = lang === "bn" ? "bn-BD" : "en-BD";

  const cutoff = useMemo(() => {
    if (period === "all") return 0;
    const days = period === "7" ? 7 : 30;
    return Date.now() - days * 86400_000;
  }, [period]);

  const filteredTxns = useMemo(
    () => paymentTxns.filter(t => new Date(t.created_at).getTime() >= cutoff),
    [paymentTxns, cutoff],
  );

  const mdrFrac = mdrFraction(merchant?.mdr_rate);
  const totalRevenue = filteredTxns.reduce((s, t) => s + t.amount, 0);
  const totalMDR = Math.round(totalRevenue * mdrFrac);
  const netSettlement = totalRevenue - totalMDR;

  // Pending = txns from today (not yet settled on T+1)
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const pendingTxns = paymentTxns.filter(x => new Date(x.created_at).getTime() >= todayStart.getTime());
  const pendingGross = pendingTxns.reduce((s, t) => s + t.amount, 0);
  const pendingNet = pendingGross - Math.round(pendingGross * mdrFrac);

  const nextPayoutDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString(localeDate, { weekday: "short", day: "numeric", month: "short" });
  }, [localeDate]);

  const dailyBatches = useMemo(() => {
    const groups: Record<string, { date: string; amount: number; count: number; mdr: number }> = {};
    filteredTxns.forEach(tx => {
      const day = new Date(tx.created_at).toLocaleDateString(localeDate, { year: "numeric", month: "short", day: "numeric" });
      if (!groups[day]) groups[day] = { date: day, amount: 0, count: 0, mdr: 0 };
      groups[day].amount += tx.amount;
      groups[day].count++;
      groups[day].mdr += Math.round(tx.amount * mdrFrac);
    });
    return Object.values(groups).reverse();
  }, [filteredTxns, mdrFrac, localeDate]);

  const exportCsv = () => {
    const rows = [["Date", "Transactions", "Gross (BDT)", "MDR (BDT)", "Net (BDT)"]];
    dailyBatches.forEach(b => rows.push([b.date, String(b.count), String(b.amount), String(b.mdr), String(b.amount - b.mdr)]));
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `settlement-${period}-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: t("stlmExportedToast") });
  };

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={stagger.item}>
        <Card className="p-5 border-0 shadow-elevated relative overflow-hidden" style={{
          background: "linear-gradient(150deg, hsl(24 90% 50%) 0%, hsl(350 65% 38%) 100%)"
        }}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-15" style={{
            background: "radial-gradient(circle, hsl(36 95% 65%) 0%, transparent 70%)"
          }} />
          <div className="relative">
            <p className="text-[11px] text-primary-foreground/70 font-medium uppercase tracking-wider">{t("stlmNetSettlement")}</p>
            <p className="text-3xl font-black text-primary-foreground mt-1">৳{fmtN(netSettlement)}</p>
            <div className="flex items-center gap-4 mt-2 text-[10px] text-primary-foreground/60">
              <span>{t("stlmGross")}: ৳{fmtN(totalRevenue)}</span>
              <span>{t("stlmMdr")}: -৳{fmtN(totalMDR)}</span>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Period filter + export */}
      <motion.div variants={stagger.item} className="flex items-center gap-2">
        <div className="flex-1 flex gap-1.5 p-1 rounded-xl bg-muted/50">
          {([
            { k: "7", label: t("stlmPeriod7") },
            { k: "30", label: t("stlmPeriod30") },
            { k: "all", label: t("stlmPeriodAll") },
          ] as const).map(o => (
            <button
              key={o.k}
              onClick={() => setPeriod(o.k)}
              className={`flex-1 h-8 rounded-lg text-[11px] font-semibold transition-colors ${period === o.k ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" className="h-9 px-3 text-[11px]" onClick={exportCsv} disabled={dailyBatches.length === 0}>
          <Download size={12} className="mr-1" /> {t("stlmExportCsv")}
        </Button>
      </motion.div>

      {/* Pending / Next payout */}
      <motion.div variants={stagger.item} className="grid grid-cols-2 gap-2.5">
        <Card className="p-3 border-0 shadow-card">
          <div className="flex items-center gap-1.5 mb-1">
            <Timer size={12} className="text-amber-600" />
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">{t("stlmPending")}</p>
          </div>
          <p className="text-lg font-extrabold text-foreground">৳{fmtN(pendingNet)}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{t("stlmPendingDesc")}</p>
        </Card>
        <Card className="p-3 border-0 shadow-card">
          <div className="flex items-center gap-1.5 mb-1">
            <CalendarClock size={12} className="text-primary" />
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">{t("stlmNextPayout")}</p>
          </div>
          <p className="text-lg font-extrabold text-foreground">{nextPayoutDate}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{merchant?.settlement_frequency || "T+1"}</p>
        </Card>
      </motion.div>

      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Landmark size={14} className="text-primary" /> {t("stlmBankDetails")}
          </h3>
          <div className="space-y-2 text-xs">
            {[
              { label: t("stlmBank"), value: merchant?.bank_name || t("stlmNotConfigured") },
              { label: t("stlmAccount"), value: merchant?.bank_account_number ? `****${merchant.bank_account_number.slice(-4)}` : "—" },
              { label: t("stlmRouting"), value: merchant?.bank_routing || "—" },
              { label: t("stlmFrequency"), value: merchant?.settlement_frequency || "T+1" },
            ].map(r => (
              <div key={r.label} className="flex justify-between py-2 border-b border-border/50 last:border-0">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-semibold text-foreground">{r.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3">{t("stlmBatches")}</h3>
          {dailyBatches.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                <BanknoteIcon className="w-7 h-7 text-muted-foreground" />
              </motion.div>
              <p className="text-sm font-semibold text-foreground">{t("stlmNoBatches")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("stlmBatchesEmpty")}</p>
            </motion.div>
          ) : (
            <div className="space-y-2">
              {dailyBatches.map((b, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-muted/30 border border-border/50 hover:border-border transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-muted-foreground" />
                      <p className="text-xs font-semibold text-foreground">{b.date}</p>
                    </div>
                    <Badge variant="secondary" className="text-[9px]">{t("stlmTxns").replace("{count}", fmtN(b.count))}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">{t("stlmGross")}: ৳{fmtN(b.amount)}</span>
                    <span className="text-red-500">{t("stlmMdr")}: -৳{fmtN(b.mdr)}</span>
                    <span className="font-bold text-emerald-600">{t("stlmNet")}: ৳{fmtN(b.amount - b.mdr)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
};

/* ── MDR Analytics Tab ── */
const MDRTab = ({ merchant, paymentTxns }: { merchant: MerchantInfo | null; paymentTxns: TxnRow[] }) => {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const fmtN = (n: number) => new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-BD").format(n);
  const mdrFrac = mdrFraction(merchant?.mdr_rate);
  const totalRevenue = paymentTxns.reduce((s, t) => s + t.amount, 0);
  const totalMDR = Math.round(totalRevenue * mdrFrac);
  const avgTxnSize = paymentTxns.length > 0 ? Math.round(totalRevenue / paymentTxns.length) : 0;
  const avgMDRPerTxn = paymentTxns.length > 0 ? Math.round(totalMDR / paymentTxns.length) : 0;

  // Effective rate (actual MDR / gross)
  const effectiveRate = totalRevenue > 0 ? (totalMDR / totalRevenue) * 100 : 0;

  // Monthly projection based on recent daily average
  const projection = useMemo(() => {
    if (paymentTxns.length === 0) return { mdr: 0, gross: 0 };
    const timestamps = paymentTxns.map(x => new Date(x.created_at).getTime());
    const span = Math.max(1, (Math.max(...timestamps) - Math.min(...timestamps)) / 86400_000);
    const daily = totalRevenue / span;
    return { gross: Math.round(daily * 30), mdr: Math.round(daily * 30 * mdrFrac) };
  }, [paymentTxns, totalRevenue, mdrFrac]);

  const ranges = [
    { label: "< ৳500", min: 0, max: 500 },
    { label: "৳500-2K", min: 500, max: 2000 },
    { label: "৳2K-5K", min: 2000, max: 5000 },
    { label: "৳5K-10K", min: 5000, max: 10000 },
    { label: "> ৳10K", min: 10000, max: Infinity },
  ];
  const distribution = ranges.map(r => ({
    ...r,
    count: paymentTxns.filter(t => t.amount >= r.min && t.amount < r.max).length,
    volume: paymentTxns.filter(t => t.amount >= r.min && t.amount < r.max).reduce((s, t) => s + t.amount, 0),
  }));
  const maxCount = Math.max(...distribution.map(d => d.count), 1);

  const downloadStatement = () => {
    const rows = [
      ["Metric", "Value"],
      ["MDR Rate", formatMdrPercent(merchant?.mdr_rate)],
      ["Total Revenue (BDT)", String(totalRevenue)],
      ["Total MDR Paid (BDT)", String(totalMDR)],
      ["Effective Rate (%)", effectiveRate.toFixed(3)],
      ["Avg MDR per Txn (BDT)", String(avgMDRPerTxn)],
      ["Avg Txn Size (BDT)", String(avgTxnSize)],
      ["Projected Monthly MDR (BDT)", String(projection.mdr)],
      ["Projected Monthly Gross (BDT)", String(projection.gross)],
    ];
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `fee-statement-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: t("feesStatementToast") });
  };

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={stagger.item}>
        <Card className="p-5 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Percent size={14} className="text-primary" /> {t("feesSummary")}
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: t("feesYourRate"), value: formatMdrPercent(merchant?.mdr_rate), icon: Percent, color: "bg-primary/10 text-primary" },
              { label: t("feesTotalPaid"), value: `৳${fmtN(totalMDR)}`, icon: DollarSign, color: "bg-red-500/10 text-red-500" },
              { label: t("feesAvgPerTxn"), value: `৳${fmtN(avgMDRPerTxn)}`, icon: Receipt, color: "bg-amber-500/10 text-amber-600" },
              { label: t("feesAvgTxnSize"), value: `৳${fmtN(avgTxnSize)}`, icon: CreditCard, color: "bg-blue-500/10 text-blue-600" },
            ].map(m => (
              <div key={m.label} className="p-3 rounded-xl bg-muted/30 border border-border/30">
                <div className={`w-7 h-7 rounded-lg ${m.color} flex items-center justify-center mb-2`}>
                  <m.icon size={13} />
                </div>
                <p className="text-base font-extrabold text-foreground">{m.value}</p>
                <p className="text-[9px] text-muted-foreground font-medium">{m.label}</p>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Effective Rate + Monthly Projection */}
      <motion.div variants={stagger.item} className="grid grid-cols-2 gap-2.5">
        <Card className="p-3.5 border-0 shadow-card">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown size={12} className="text-emerald-600" />
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">{t("feesEffectiveRate")}</p>
          </div>
          <p className="text-xl font-extrabold text-foreground">{effectiveRate.toFixed(2)}%</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{t("feesEffectiveDesc")}</p>
        </Card>
        <Card className="p-3.5 border-0 shadow-card">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={12} className="text-primary" />
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">{t("feesMonthlyProjection")}</p>
          </div>
          <p className="text-xl font-extrabold text-foreground">৳{fmtN(projection.mdr)}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{t("feesProjectionDesc")}</p>
        </Card>
      </motion.div>

      <motion.div variants={stagger.item}>
        <Button variant="outline" size="sm" className="w-full h-9 text-[11px]" onClick={downloadStatement} disabled={paymentTxns.length === 0}>
          <Download size={12} className="mr-1.5" /> {t("feesDownloadStatement")}
        </Button>
      </motion.div>

      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3">{t("feesDistribution")}</h3>
          <div className="space-y-3">
            {distribution.map(d => (
              <div key={d.label} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-foreground">{d.label}</span>
                  <span className="text-[10px] text-muted-foreground">{t("feesTxnsVolume").replace("{count}", fmtN(d.count)).replace("{volume}", fmtN(d.volume))}</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(d.count / maxCount) * 100}%` }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(135deg, hsl(24 90% 50%), hsl(350 65% 38%))" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3">{t("feesComparison")}</h3>
          <div className="space-y-1.5 text-xs">
            {[
              { category: t("feesCatRetail"), rate: "1.50%", yours: merchant?.category === "retail" },
              { category: t("feesCatRestaurant"), rate: "1.50%", yours: merchant?.category === "restaurant" },
              { category: t("feesCatGrocery"), rate: "1.20%", yours: merchant?.category === "grocery" },
              { category: t("feesCatPharmacy"), rate: "1.00%", yours: merchant?.category === "pharmacy" },
              { category: t("feesCatEducation"), rate: "0.80%", yours: merchant?.category === "education" },
              { category: t("feesCatUtility"), rate: "0.50%", yours: merchant?.category === "utility" },
            ].map(r => (
              <div key={r.category} className={`flex items-center justify-between py-2.5 px-3 rounded-xl transition-colors ${r.yours ? "bg-primary/5 border border-primary/20 shadow-sm" : "hover:bg-muted/30"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-medium capitalize">{r.category}</span>
                  {r.yours && <Badge className="text-[8px] bg-primary/10 text-primary border-0">{t("feesYourRateBadge")}</Badge>}
                </div>
                <span className="font-bold text-foreground">{r.rate}</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};

/* ── Payment Links Tab ── */
interface PaymentLink {
  id: string;
  short_code: string;
  amount: number | null;
  note: string | null;
  is_active: boolean;
  used_count: number;
  created_at: string;
  merchant_id: string | null;
  merchant_code: string | null;
  total_collected?: number;
}

const PayLinksTab = ({ merchant, toast }: { merchant: MerchantInfo | null; toast: any }) => {
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [linkPayments, setLinkPayments] = useState<Record<string, any[]>>({});
  const { user } = useAuth();
  const { t, lang } = useI18n();

  const baseUrl = window.location.origin;
  const merchantCode = merchant?.qr_code_data || `MRC-${merchant?.id?.slice(0, 8) || "UNKNOWN"}`;

  // Load links from DB
  const fetchLinks = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("payment_links")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) {
      setLinks(data.map(d => ({
        id: d.id,
        short_code: d.short_code,
        amount: d.amount ? Number(d.amount) : null,
        note: d.note ?? d.description,
        is_active: d.is_active,
        used_count: d.used_count,
        created_at: d.created_at,
        merchant_id: d.merchant_id,
        merchant_code: d.merchant_code,
      })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("payment_links_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_links", filter: `created_by=eq.${user.id}` }, () => {
        fetchLinks();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchLinks]);

  const generateLink = async () => {
    if (!user || !merchant) return;
    const parsedAmount = amount ? parseFloat(amount) : null;

    if (parsedAmount !== null && (isNaN(parsedAmount) || parsedAmount <= 0)) {
      toast({ title: "Invalid amount", description: "Please enter a valid positive amount", variant: "destructive" });
      return;
    }
    if (parsedAmount !== null && parsedAmount > 1000000) {
      toast({ title: "Amount too high", description: "Maximum amount is ৳10,00,000", variant: "destructive" });
      return;
    }

    const shortCode = Math.random().toString(36).slice(2, 10).toUpperCase();

    const { error } = await supabase.from("payment_links").insert({
      title: note.trim() || (parsedAmount ? `৳${parsedAmount} Payment` : "Open Payment"),
      short_code: shortCode,
      amount: parsedAmount,
      note: note.trim() || null,
      description: note.trim() || null,
      merchant_id: merchant.id,
      merchant_code: merchantCode,
      created_by: user.id,
      is_active: true,
    });

    if (error) {
      toast({ title: "Failed to create link", description: error.message, variant: "destructive" });
      return;
    }

    setAmount("");
    setNote("");
    toast({ title: "Payment link created!", description: "Share it with your customer" });
    fetchLinks();
  };

  const buildUrl = (link: PaymentLink) => {
    const code = link.merchant_code || merchantCode;
    const params = new URLSearchParams({ merchant: code, ref: link.short_code });
    if (link.amount) params.set("amount", link.amount.toString());
    if (link.note) params.set("note", link.note);
    return `${baseUrl}/pay?${params.toString()}`;
  };

  const copyLink = (link: PaymentLink) => {
    navigator.clipboard.writeText(buildUrl(link));
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const shareLink = async (link: PaymentLink) => {
    const url = buildUrl(link);
    const text = `Pay ${merchant?.business_name || "merchant"}${link.amount ? ` ৳${fmt(link.amount)}` : ""}${link.note ? ` — ${link.note}` : ""}`;
    if (navigator.share) {
      try { await navigator.share({ title: t("plmcShareTitle"), text, url }); } catch {}
    } else {
      copyLink(link);
    }
  };

  const toggleActive = async (link: PaymentLink) => {
    const newActive = !link.is_active;
    await supabase.from("payment_links").update({ is_active: newActive }).eq("id", link.id);
    toast({ title: newActive ? "Link reactivated" : "Link revoked", description: newActive ? "Customers can pay again" : "This link will no longer accept payments" });
    fetchLinks();
  };

  const removeLink = async (id: string) => {
    await supabase.from("payment_links").delete().eq("id", id);
    toast({ title: "Link deleted" });
    fetchLinks();
  };

  const loadLinkPayments = async (linkId: string, shortCode: string) => {
    if (linkPayments[linkId]) {
      setExpandedId(expandedId === linkId ? null : linkId);
      return;
    }
    // Find payments matching this link's reference
    const { data } = await supabase
      .from("transactions")
      .select("id, amount, created_at, recipient_name, short_id")
      .eq("reference", shortCode)
      .eq("type", "payment")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(20);
    setLinkPayments(prev => ({ ...prev, [linkId]: data || [] }));
    setExpandedId(expandedId === linkId ? null : linkId);
  };

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-4">
      {/* Create link card */}
      <motion.div variants={stagger.item}>
        <Card className="p-5 border-0 shadow-elevated relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-5" style={{
            background: "radial-gradient(circle, hsl(24 90% 50%) 0%, transparent 70%)"
          }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Link size={18} className="text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">{t("plmcCreateTitle")}</h3>
                <p className="text-[10px] text-muted-foreground">{t("plmcCreateSubtitle")}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                  {t("plmcAmountLabel")}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">৳</span>
                  <Input
                    type="number"
                    placeholder={t("plmcAmountPlaceholder")}
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="pl-8 h-11 rounded-xl border-border/50 bg-muted/30 focus:bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                  {t("plmcNoteLabel")}
                </label>
                <Input
                  placeholder={t("plmcNotePlaceholder")}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  maxLength={100}
                  className="h-11 rounded-xl border-border/50 bg-muted/30 focus:bg-background"
                />
              </div>

              <Button
                onClick={generateLink}
                className="w-full h-12 rounded-xl text-sm font-bold shadow-glow"
                style={{ background: "linear-gradient(135deg, hsl(24 90% 50%), hsl(350 65% 38%))" }}
              >
                <Plus size={16} className="mr-1.5" /> {t("plmcGenerate")}
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* How it works */}
      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Sparkles size={14} className="text-primary" /> {t("plmcHowItWorks")}
          </h3>
          <div className="space-y-3">
            {[
              { step: "1", title: t("plmcStep1Title"), desc: t("plmcStep1Desc") },
              { step: "2", title: t("plmcStep2Title"), desc: t("plmcStep2Desc") },
              { step: "3", title: t("plmcStep3Title"), desc: t("plmcStep3Desc") },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{s.step}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{s.title}</p>
                  <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Generated links */}
      {loading ? (
        <Card className="p-8 border-0 shadow-card flex items-center justify-center">
          <RefreshCw size={16} className="animate-spin text-muted-foreground" />
        </Card>
      ) : links.length > 0 ? (
        <motion.div variants={stagger.item}>
          <Card className="p-4 border-0 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground">{t("plmcYourLinks")}</h3>
              <Badge variant="secondary" className="text-[9px]">{t("plmcLinksCount").replace("{count}", String(links.length))}</Badge>
            </div>
            <div className="space-y-2.5">
              {links.map(link => (
                <motion.div
                  key={link.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3.5 rounded-xl border ${link.is_active ? "bg-muted/30 border-border/50" : "bg-destructive/5 border-destructive/20 opacity-70"}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-foreground">
                          {link.amount ? `৳${fmt(link.amount)}` : t("plmcOpenAmount")}
                        </span>
                        <Badge variant={link.is_active ? "secondary" : "destructive"} className="text-[8px]">
                          {link.is_active ? t("plmcActive") : t("plmcRevoked")}
                        </Badge>
                        {link.used_count > 0 && (
                          <Badge variant="outline" className="text-[8px] text-primary border-primary/30">
                            {t("plmcPaidCount").replace("{count}", String(link.used_count))}
                          </Badge>
                        )}
                      </div>
                      {link.note && (
                        <p className="text-[10px] text-muted-foreground truncate">{link.note}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleActive(link)} className="tap-target text-muted-foreground hover:text-primary transition-colors" title={link.is_active ? t("plmcRevoke") : t("plmcReactivate")}>
                        {link.is_active ? <Lock size={13} /> : <CheckCircle2 size={13} />}
                      </button>
                      <button onClick={() => removeLink(link.id)} className="tap-target text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* URL preview */}
                  <div className="bg-background/60 rounded-lg p-2 mb-2.5">
                    <p className="text-[9px] text-muted-foreground font-mono truncate">{buildUrl(link)}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 rounded-lg text-[11px]"
                      onClick={() => copyLink(link)}
                      disabled={!link.is_active}
                    >
                      {copiedId === link.id ? (
                        <><Check size={12} className="mr-1 text-primary" /> {t("plmcCopied")}</>
                      ) : (
                        <><Copy size={12} className="mr-1" /> {t("plmcCopyLink")}</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 rounded-lg text-[11px]"
                      onClick={() => shareLink(link)}
                      disabled={!link.is_active}
                    >
                      <Share2 size={12} className="mr-1" /> {t("plmcShare")}
                    </Button>
                  </div>

                  {/* Payment tracking */}
                  <button
                    onClick={() => loadLinkPayments(link.id, link.short_code)}
                    className="w-full mt-2 flex items-center justify-between text-[10px] text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    <span className="flex items-center gap-1">
                      <Receipt size={10} /> {t("plmcPaymentsReceived").replace("{count}", String(link.used_count))}
                    </span>
                    <ChevronDown size={10} className={`transition-transform ${expandedId === link.id ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence>
                    {expandedId === link.id && linkPayments[link.id] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        {linkPayments[link.id].length === 0 ? (
                          <p className="text-[10px] text-muted-foreground text-center py-3">{t("plmcNoPaymentsYet")}</p>
                        ) : (
                          <div className="mt-1 space-y-1.5">
                            {linkPayments[link.id].map((txn: any) => (
                              <div key={txn.id} className="flex items-center justify-between bg-background/60 rounded-lg px-2.5 py-2">
                                <div>
                                  <p className="text-[10px] font-semibold text-foreground">৳{fmt(txn.amount)}</p>
                                  <p className="text-[8px] text-muted-foreground">{txn.recipient_name || t("plmcCustomer")}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[8px] text-muted-foreground">
                                    {new Date(txn.created_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-BD", { day: "numeric", month: "short" })}
                                  </p>
                                  <p className="text-[7px] text-muted-foreground font-mono">{txn.short_id}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <p className="text-[8px] text-muted-foreground mt-2 text-right">
                    {t("plmcCreatedOn").replace("{date}", new Date(link.created_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-BD", { day: "numeric", month: "short", year: "numeric" }))}
                  </p>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      ) : null}

      {/* Benefits */}
      <motion.div variants={stagger.item}>
        <Card className="p-4 border-0 shadow-card">
          <h3 className="text-sm font-bold text-foreground mb-3">{t("plmcWhyTitle")}</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { icon: Globe, title: t("plmcWhyRemote"), desc: t("plmcWhyRemoteDesc") },
              { icon: Zap, title: t("plmcWhyInstant"), desc: t("plmcWhyInstantDesc") },
              { icon: ShieldCheck, title: t("plmcWhySecure"), desc: t("plmcWhySecureDesc") },
              { icon: Receipt, title: t("plmcWhyTracked"), desc: t("plmcWhyTrackedDesc") },
            ].map(b => (
              <div key={b.title} className="p-3 rounded-xl bg-muted/30 text-center">
                <b.icon size={16} className="text-primary mx-auto mb-1.5" />
                <p className="text-[11px] font-semibold text-foreground">{b.title}</p>
                <p className="text-[9px] text-muted-foreground">{b.desc}</p>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ── Merchant Send Money Sheet ── */
const MERCH_SEND_DAILY_LIMIT = 15000;
const MERCH_SEND_MAX_QUOTA = 10;

const MerchantSendMoneySheet = ({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess?: () => void }) => {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const phoneValidation = usePhoneValidation(phone);
  const [step, setStep] = useState<"details" | "pin" | "success">("details");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinVerified, setPinVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [dailyUsed, setDailyUsed] = useState(0);
  const [dailyCount, setDailyCount] = useState(0);
  const [successData, setSuccessData] = useState<{ amount: number; to: string; ref: string } | null>(null);

  const { calcFee: calcSendFee } = useFeeConfig();
  const parsedAmount = parseFloat(amount) || 0;
  const fee = calcSendFee("send", parsedAmount);
  const total = parsedAmount + fee;
  const dailyRemaining = MERCH_SEND_DAILY_LIMIT - dailyUsed;
  const quotaRemaining = MERCH_SEND_MAX_QUOTA - dailyCount;

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("transactions").select("amount")
        .eq("user_id", session.user.id).eq("type", "send" as any)
        .eq("status", "completed").gte("created_at", today.toISOString());
      const rows = data ?? [];
      setDailyUsed(rows.reduce((s, t) => s + Number(t.amount), 0));
      setDailyCount(rows.length);
    })();
  }, [open]);

  const resetState = () => {
    setPhone(""); setAmount(""); setStep("details"); setPin(""); setPinError(""); setPinVerified(false); setSuccessData(null);
  };

  const goToPin = () => {
    if (phoneValidation.triggerShake()) {
      toast({ title: "Invalid number", description: "Enter a valid 11-digit number starting with 01", variant: "destructive" }); return;
    }
    if (parsedAmount <= 0 || parsedAmount > 50000) {
      toast({ title: "Invalid amount", description: "Amount must be between ৳1 and ৳50,000", variant: "destructive" }); return;
    }
    if (parsedAmount > dailyRemaining) {
      toast({ title: "Daily limit exceeded", description: `Only ৳${fmt(dailyRemaining)} remaining today`, variant: "destructive" }); return;
    }
    if (quotaRemaining <= 0) {
      toast({ title: "Quota exhausted", description: `Max ${MERCH_SEND_MAX_QUOTA} Send Money transactions per day`, variant: "destructive" }); return;
    }
    setStep("pin"); setPin(""); setPinError(""); setPinVerified(false);
  };

  const handlePinDigit = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d; setPin(next); setPinError("");
    if (next.length === 4) {
      setVerifying(true);
      verifyPin(next).then(ok => {
        setVerifying(false);
        if (ok) { setPinVerified(true); haptics.success(); }
        else { setPinError("Incorrect PIN"); setPin(""); haptics.error(); }
      });
    }
  };
  const handlePinDelete = () => { setPin(p => p.slice(0, -1)); setPinError(""); };

  const handleSend = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.rpc("transfer_money", {
        p_recipient_phone: phone,
        p_amount: parsedAmount,
        p_fee: fee,
        p_type: "send" as const,
        p_description: "Merchant Send Money",
      });
      if (error) throw error;
      const ref = `SM${Date.now().toString(36).toUpperCase()}`;
      setSuccessData({ amount: parsedAmount, to: phone, ref });
      setStep("success");
      haptics.success();
      onSuccess?.();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message || "Something went wrong", variant: "destructive" });
      setPin(""); setPinVerified(false);
    } finally {
      setProcessing(false);
    }
  };

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => { resetState(); onClose(); }}>
        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", bounce: 0.15 }}
          className="w-full max-w-xl bg-card rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="w-12 h-1 bg-muted rounded-full mx-auto" />
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Send size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-foreground">Send Money</h3>
              <p className="text-[11px] text-muted-foreground">{step === "success" ? "Transaction complete" : step === "pin" ? "Enter PIN to confirm" : "Flat ৳5 fee per transaction"}</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === "details" ? (
              <motion.div key="details" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                {/* Daily limit badge */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-2">
                    <Info size={12} className="text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-medium">Daily: ৳{fmt(dailyRemaining)} left · {quotaRemaining}/{MERCH_SEND_MAX_QUOTA} txns</span>
                  </div>
                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${dailyRemaining < MERCH_SEND_DAILY_LIMIT * 0.2 ? "bg-amber-500" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, (dailyUsed / MERCH_SEND_DAILY_LIMIT) * 100)}%` }} />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Recipient Number</label>
                  <div className="flex gap-2">
                    <Input placeholder="01XXXXXXXXX" value={phone} onChange={e => setPhone(normalizeBDPhoneInput(e.target.value))} onBlur={() => phoneValidation.setTouched(true)} className={`h-12 rounded-xl text-lg flex-1 ${phoneValidation.inputClassName}`} inputMode="numeric" />
                    <Button variant="outline" className="h-12 w-12 rounded-xl shrink-0 border-dashed border-primary/40" onClick={() => setShowQr(true)}>
                      <ScanLine size={18} className="text-primary" />
                    </Button>
                  </div>
                  {phoneValidation.showError && <p className="text-[10px] text-destructive font-medium mt-1 animate-fade-in">{phoneValidation.errorMessage}</p>}
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Amount (Max ৳{fmt(MERCH_SEND_DAILY_LIMIT)}/day)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">৳</span>
                    <Input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="pl-8 h-12 rounded-xl text-lg" inputMode="decimal" />
                  </div>
                </div>
                {parsedAmount > 0 && (
                  <div className="p-3 rounded-xl bg-muted/40 text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold text-foreground">৳{fmt(parsedAmount)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span className="font-semibold text-foreground">৳{fee}</span></div>
                    <div className="flex justify-between border-t border-border/50 pt-1"><span className="font-bold text-foreground">Total</span><span className="font-bold text-foreground">৳{fmt(total)}</span></div>
                  </div>
                )}
                <Button onClick={goToPin} disabled={quotaRemaining <= 0 || dailyRemaining <= 0} className="w-full h-12 rounded-xl text-sm font-bold" style={{ background: "linear-gradient(135deg, hsl(217 80% 50%), hsl(226 75% 40%))" }}>
                  {quotaRemaining <= 0 ? "Quota Exhausted" : dailyRemaining <= 0 ? "Limit Reached" : "Continue → Enter PIN"}
                </Button>
              </motion.div>
            ) : step === "pin" ? (
              <motion.div key="pin" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                <div className="p-3 rounded-xl bg-muted/40 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">To</span><span className="font-semibold text-foreground">{phone}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold text-foreground">৳{fmt(parsedAmount)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span className="font-semibold text-foreground">৳{fee}</span></div>
                  <div className="flex justify-between border-t border-border/50 pt-1"><span className="font-bold text-foreground">Total</span><span className="font-bold text-foreground">৳{fmt(total)}</span></div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Lock size={14} className="text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground">Enter 4-Digit PIN</span>
                  </div>
                  <div className="flex justify-center gap-3 mb-2">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className={`w-4 h-4 rounded-full transition-all duration-200 ${i < pin.length ? "bg-primary scale-110" : "bg-muted-foreground/20"}`} />
                    ))}
                  </div>
                  {pinError && <p className="text-[11px] text-destructive font-medium">{pinError}</p>}
                  {verifying && <p className="text-[11px] text-muted-foreground animate-pulse">Verifying...</p>}
                </div>
                <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
                  {[1,2,3,4,5,6,7,8,9].map(d => (
                    <button key={d} onClick={() => handlePinDigit(String(d))} disabled={verifying || pinVerified}
                      className="h-12 rounded-xl bg-muted/50 hover:bg-muted text-lg font-bold text-foreground transition-colors press-effect">{d}</button>
                  ))}
                  <button onClick={() => setStep("details")} className="h-12 rounded-xl bg-muted/30 text-xs font-semibold text-muted-foreground">Back</button>
                  <button onClick={() => handlePinDigit("0")} disabled={verifying || pinVerified}
                    className="h-12 rounded-xl bg-muted/50 hover:bg-muted text-lg font-bold text-foreground transition-colors press-effect">0</button>
                  <button onClick={handlePinDelete} disabled={verifying || pinVerified}
                    className="h-12 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground"><Delete size={18} /></button>
                </div>
                <SlideToConfirm onConfirm={handleSend} label={processing ? "Sending..." : `Send ৳${fmt(parsedAmount)}`} disabled={!pinVerified || processing} pinComplete={pinVerified} />
              </motion.div>
            ) : (
              /* Success Card */
              <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-xl font-black text-foreground">৳{fmt(successData?.amount ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Sent to {successData?.to}</p>
                </div>
                <Card className="p-3 border-0 bg-muted/30 text-xs text-left space-y-1.5">
                  <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-semibold text-foreground">Send Money</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span className="font-semibold text-foreground">৳{fee}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Ref</span><span className="font-mono text-foreground">{successData?.ref}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span className="text-foreground">{new Date().toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" })}</span></div>
                </Card>
                <Button onClick={() => { resetState(); onClose(); }} className="w-full h-12 rounded-xl text-sm font-bold" variant="outline">
                  Done
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      <QrScannerModal open={showQr} onClose={() => setShowQr(false)} onScan={(result) => setPhone(normalizeBDPhoneInput(result))} title="Scan Recipient QR" />
    </>
  );
};

/* ── Merchant Cash Out Sheet ── */
const MERCH_CASHOUT_DAILY_LIMIT = 20000;
const MERCH_CASHOUT_MAX_QUOTA = 5;

const MerchantCashOutSheet = ({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess?: () => void }) => {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [agentId, setAgentId] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [step, setStep] = useState<"details" | "pin" | "success">("details");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinVerified, setPinVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [dailyUsed, setDailyUsed] = useState(0);
  const [dailyCount, setDailyCount] = useState(0);
  const [successData, setSuccessData] = useState<{ amount: number; to: string; fee: number; ref: string } | null>(null);

  const { calcCashOutFee } = useFeeConfig();
  const parsedAmount = parseFloat(amount) || 0;
  const fee = calcCashOutFee(parsedAmount);
  const total = parsedAmount + fee;
  const dailyRemaining = MERCH_CASHOUT_DAILY_LIMIT - dailyUsed;
  const quotaRemaining = MERCH_CASHOUT_MAX_QUOTA - dailyCount;

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("transactions").select("amount")
        .eq("user_id", session.user.id).eq("type", "cashout" as any)
        .eq("status", "completed").gte("created_at", today.toISOString());
      const rows = data ?? [];
      setDailyUsed(rows.reduce((s, t) => s + Number(t.amount), 0));
      setDailyCount(rows.length);
    })();
  }, [open]);

  const resetState = () => {
    setAmount(""); setAgentId(""); setStep("details"); setPin(""); setPinError(""); setPinVerified(false); setSuccessData(null);
  };

  const goToPin = () => {
    if (!agentId || agentId.length < 5) {
      toast({ title: "Invalid Agent ID", description: "Enter a valid agent number", variant: "destructive" }); return;
    }
    if (parsedAmount < 30 || parsedAmount > 50000) {
      toast({ title: "Invalid amount", description: "Amount must be between ৳30 and ৳50,000", variant: "destructive" }); return;
    }
    if (parsedAmount > dailyRemaining) {
      toast({ title: "Daily limit exceeded", description: `Only ৳${fmt(dailyRemaining)} remaining today`, variant: "destructive" }); return;
    }
    if (quotaRemaining <= 0) {
      toast({ title: "Quota exhausted", description: `Max ${MERCH_CASHOUT_MAX_QUOTA} Cash Out transactions per day`, variant: "destructive" }); return;
    }
    setStep("pin"); setPin(""); setPinError(""); setPinVerified(false);
  };

  const handlePinDigit = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d; setPin(next); setPinError("");
    if (next.length === 4) {
      setVerifying(true);
      verifyPin(next).then(ok => {
        setVerifying(false);
        if (ok) { setPinVerified(true); haptics.success(); }
        else { setPinError("Incorrect PIN"); setPin(""); haptics.error(); }
      });
    }
  };
  const handlePinDelete = () => { setPin(p => p.slice(0, -1)); setPinError(""); };

  const handleCashOut = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.rpc("record_transaction", {
        p_type: "cashout" as const,
        p_amount: parsedAmount,
        p_fee: fee,
        p_recipient_phone: agentId,
        p_description: "Merchant Cash Out",
      });
      if (error) throw error;
      const ref = `CO${Date.now().toString(36).toUpperCase()}`;
      setSuccessData({ amount: parsedAmount, to: agentId, fee, ref });
      setStep("success");
      haptics.success();
      onSuccess?.();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message || "Something went wrong", variant: "destructive" });
      setPin(""); setPinVerified(false);
    } finally {
      setProcessing(false);
    }
  };

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => { resetState(); onClose(); }}>
        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", bounce: 0.15 }}
          className="w-full max-w-xl bg-card rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="w-12 h-1 bg-muted rounded-full mx-auto" />
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <HandCoins size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-foreground">Cash Out</h3>
              <p className="text-[11px] text-muted-foreground">{step === "success" ? "Transaction complete" : step === "pin" ? "Enter PIN to confirm" : "1.15% charge · Min ৳30 · Max ৳50,000"}</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === "details" ? (
              <motion.div key="details" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                {/* Daily limit badge */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-2">
                    <Info size={12} className="text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-medium">Daily: ৳{fmt(dailyRemaining)} left · {quotaRemaining}/{MERCH_CASHOUT_MAX_QUOTA} txns</span>
                  </div>
                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${dailyRemaining < MERCH_CASHOUT_DAILY_LIMIT * 0.2 ? "bg-amber-500" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, (dailyUsed / MERCH_CASHOUT_DAILY_LIMIT) * 100)}%` }} />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Agent Number</label>
                  <div className="flex gap-2">
                    <Input placeholder="Agent ID or number" value={agentId} onChange={e => setAgentId(normalizeBDPhoneInput(e.target.value))} className="h-12 rounded-xl flex-1" inputMode="numeric" />
                    <Button variant="outline" className="h-12 w-12 rounded-xl shrink-0 border-dashed border-primary/40" onClick={() => setShowQr(true)}>
                      <ScanLine size={18} className="text-primary" />
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Amount (Max ৳{fmt(MERCH_CASHOUT_DAILY_LIMIT)}/day)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">৳</span>
                    <Input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="pl-8 h-12 rounded-xl text-lg" inputMode="decimal" />
                  </div>
                </div>
                {parsedAmount > 0 && (
                  <div className="p-3 rounded-xl bg-muted/40 text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold text-foreground">৳{fmt(parsedAmount)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Fee (1.15%)</span><span className="font-semibold text-foreground">৳{fmt(fee)}</span></div>
                    <div className="flex justify-between border-t border-border/50 pt-1"><span className="font-bold text-foreground">Total Deduction</span><span className="font-bold text-foreground">৳{fmt(total)}</span></div>
                  </div>
                )}
                <Button onClick={goToPin} disabled={quotaRemaining <= 0 || dailyRemaining <= 0} className="w-full h-12 rounded-xl text-sm font-bold" style={{ background: "linear-gradient(135deg, hsl(152 73% 39%), hsl(152 75% 29%))" }}>
                  {quotaRemaining <= 0 ? "Quota Exhausted" : dailyRemaining <= 0 ? "Limit Reached" : "Continue → Enter PIN"}
                </Button>
              </motion.div>
            ) : step === "pin" ? (
              <motion.div key="pin" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                <div className="p-3 rounded-xl bg-muted/40 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Agent</span><span className="font-semibold text-foreground">{agentId}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold text-foreground">৳{fmt(parsedAmount)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fee (1.15%)</span><span className="font-semibold text-foreground">৳{fmt(fee)}</span></div>
                  <div className="flex justify-between border-t border-border/50 pt-1"><span className="font-bold text-foreground">Total</span><span className="font-bold text-foreground">৳{fmt(total)}</span></div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Lock size={14} className="text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground">Enter 4-Digit PIN</span>
                  </div>
                  <div className="flex justify-center gap-3 mb-2">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className={`w-4 h-4 rounded-full transition-all duration-200 ${i < pin.length ? "bg-primary scale-110" : "bg-muted-foreground/20"}`} />
                    ))}
                  </div>
                  {pinError && <p className="text-[11px] text-destructive font-medium">{pinError}</p>}
                  {verifying && <p className="text-[11px] text-muted-foreground animate-pulse">Verifying...</p>}
                </div>
                <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
                  {[1,2,3,4,5,6,7,8,9].map(d => (
                    <button key={d} onClick={() => handlePinDigit(String(d))} disabled={verifying || pinVerified}
                      className="h-12 rounded-xl bg-muted/50 hover:bg-muted text-lg font-bold text-foreground transition-colors press-effect">{d}</button>
                  ))}
                  <button onClick={() => setStep("details")} className="h-12 rounded-xl bg-muted/30 text-xs font-semibold text-muted-foreground">Back</button>
                  <button onClick={() => handlePinDigit("0")} disabled={verifying || pinVerified}
                    className="h-12 rounded-xl bg-muted/50 hover:bg-muted text-lg font-bold text-foreground transition-colors press-effect">0</button>
                  <button onClick={handlePinDelete} disabled={verifying || pinVerified}
                    className="h-12 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground"><Delete size={18} /></button>
                </div>
                <SlideToConfirm onConfirm={handleCashOut} label={processing ? "Processing..." : `Cash Out ৳${fmt(parsedAmount)}`} disabled={!pinVerified || processing} pinComplete={pinVerified} />
              </motion.div>
            ) : (
              /* Success Card */
              <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-xl font-black text-foreground">৳{fmt(successData?.amount ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Cashed out to Agent {successData?.to}</p>
                </div>
                <Card className="p-3 border-0 bg-muted/30 text-xs text-left space-y-1.5">
                  <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-semibold text-foreground">Cash Out</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fee (1.15%)</span><span className="font-semibold text-foreground">৳{fmt(successData?.fee ?? 0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Ref</span><span className="font-mono text-foreground">{successData?.ref}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span className="text-foreground">{new Date().toLocaleTimeString("en-BD", { hour: "2-digit", minute: "2-digit" })}</span></div>
                </Card>
                <Button onClick={() => { resetState(); onClose(); }} className="w-full h-12 rounded-xl text-sm font-bold" variant="outline">
                  Done
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      <QrScannerModal open={showQr} onClose={() => setShowQr(false)} onScan={(result) => setAgentId(normalizeBDPhoneInput(result))} title="Scan Agent QR" />
    </>
  );
};

/* ── Merchant Add Bank Sheet ── */
const MerchantAddBankSheet = ({ open, onClose, merchant }: { open: boolean; onClose: () => void; merchant: MerchantInfo | null }) => {
  const { toast } = useToast();
  const { banks: platformBanks, loading: banksLoading, liveUpdateKey: banksLiveKey, lastSyncedAt: banksLastSyncedAt, refetch: refetchBanks } = usePlatformBanks();
  const [bankName, setBankName] = useState(merchant?.bank_name || "");

  // Auto-select the admin-marked default bank for first-time users
  // (no bank linked yet on this merchant).
  useEffect(() => {
    if (!open || bankName || merchant?.bank_name) return;
    const def = platformBanks.find(b => b.is_default);
    if (def) setBankName(def.name);
  }, [open, platformBanks, bankName, merchant?.bank_name]);
  const [accHolder, setAccHolder] = useState(merchant?.bank_account_holder || "");
  const [accNumber, setAccNumber] = useState(merchant?.bank_account_number || "");
  const [branch, setBranch] = useState(merchant?.bank_branch || "");
  const [routing, setRouting] = useState(merchant?.bank_routing || "");
  const [saving, setSaving] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [saveDetails, setSaveDetails] = useState(true);

  const filteredBanks = platformBanks.filter(b =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase()) ||
    b.short_code.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const handleSave = async () => {
    if (!bankName) {
      toast({ title: "Select a bank", description: "Please choose a bank from the list", variant: "destructive" });
      return;
    }
    if (!accHolder.trim()) {
      toast({ title: "Account holder required", description: "Please enter the account holder name", variant: "destructive" });
      return;
    }
    if (!accNumber || accNumber.length < 8) {
      toast({ title: "Invalid account number", description: "Account number must be at least 8 digits", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("merchants").update({
        bank_name: bankName,
        bank_account_number: accNumber,
        bank_routing: routing || null,
        bank_account_holder: accHolder.trim(),
        bank_branch: branch.trim() || null,
      } as any).eq("id", merchant?.id || "");
      if (error) throw error;
      toast({ title: "Bank Linked!", description: `${bankName} · ****${accNumber.slice(-4)} linked for settlement` });
      onClose();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message || "Could not save bank details", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={onClose}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", bounce: 0.12, duration: 0.5 }}
        className="w-full max-w-xl bg-card rounded-t-3xl p-6 pb-8 max-h-[92vh] overflow-y-auto scrollbar-none" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-5" />

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Landmark size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Link Bank Account</h3>
            <p className="text-xs text-muted-foreground">For auto-settlement · 1% transfer fee</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Bank Name — Searchable dropdown */}
          <div>
            
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Bank Name *</span>
              <BankListLiveBadge liveUpdateKey={banksLiveKey} label="Bank list" />
            </label>
            <div className="relative">
              <button
                onClick={() => setBankOpen(!bankOpen)}
                className={`w-full h-12 rounded-xl border bg-background px-4 text-left flex items-center justify-between transition-all ${bankName ? "text-foreground" : "text-muted-foreground"} ${bankOpen ? "border-primary ring-2 ring-primary/20" : "border-input hover:border-primary/50"}`}
              >
                <span className="text-sm truncate">{bankName || "Select a bank..."}</span>
                <ChevronDown size={16} className={`shrink-0 ml-2 transition-transform ${bankOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {bankOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className="absolute z-50 mt-1.5 w-full bg-popover border border-border rounded-xl shadow-xl overflow-hidden"
                  >
                    <div className="p-2 border-b border-border/50">
                      <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          autoFocus
                          placeholder="Search banks..."
                          value={bankSearch}
                          onChange={e => setBankSearch(e.target.value)}
                          className="w-full h-9 pl-8 pr-3 rounded-lg bg-muted/50 border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                      </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto scrollbar-none py-1">
                      {filteredBanks.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">No banks found</p>
                      )}
                      {filteredBanks.map(b => (
                        <button
                          key={b.id}
                          onClick={() => { setBankName(b.name); setBankOpen(false); setBankSearch(""); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors ${bankName === b.name ? "bg-primary/5" : ""}`}
                        >
                          {b.logo_url ? (
                            <div className="w-8 h-8 rounded-lg bg-white border border-border/40 overflow-hidden shrink-0 flex items-center justify-center">
                              <img src={b.logo_url} alt={b.name} className="w-full h-full object-contain" loading="lazy" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-[9px] font-bold text-primary">{b.short_code.slice(0, 4)}</span>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground truncate">{b.name}</p>
                            <p className="text-[10px] text-muted-foreground">{b.short_code}</p>
                          </div>
                          {bankName === b.name && <Check size={14} className="text-primary shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Account Holder Name */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Account Holder Name *</label>
            <Input
              placeholder="Full name as per bank"
              value={accHolder}
              onChange={e => setAccHolder(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          {/* Account Number */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Account Number *</label>
            <Input
              placeholder="Enter account number"
              value={accNumber}
              onChange={e => setAccNumber(e.target.value.replace(/\D/g, "").slice(0, 20))}
              className="h-12 rounded-xl"
              inputMode="numeric"
            />
          </div>

          {/* Branch Name */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Branch Name <span className="normal-case text-muted-foreground/60">(Optional)</span></label>
            <Input
              placeholder="e.g. Motijheel, Gulshan"
              value={branch}
              onChange={e => setBranch(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          {/* Routing Number */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Routing Number <span className="normal-case text-muted-foreground/60">(Optional)</span></label>
            <Input
              placeholder="9-digit routing number"
              value={routing}
              onChange={e => setRouting(e.target.value.replace(/\D/g, "").slice(0, 9))}
              className="h-12 rounded-xl"
              inputMode="numeric"
            />
          </div>

          {/* Save checkbox */}
          <label className="flex items-center gap-3 py-2 cursor-pointer select-none">
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${saveDetails ? "bg-primary border-primary" : "border-muted-foreground/30"}`}
              onClick={() => setSaveDetails(!saveDetails)}>
              {saveDetails && <Check size={12} className="text-primary-foreground" />}
            </div>
            <span className="text-xs text-foreground">Save details for faster future settlements</span>
          </label>

          {/* Fee notice */}
          <div className="p-3.5 rounded-xl bg-amber-500/8 border border-amber-500/15">
            <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium flex items-start gap-2.5">
              <Info size={14} className="shrink-0 mt-0.5 text-amber-500" />
              A 1% fee applies when funds are auto-settled to your bank. Settlements process on your configured schedule.
            </p>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSave}
            disabled={saving || !bankName || !accHolder.trim() || accNumber.length < 8}
            className="w-full h-13 rounded-xl text-sm font-bold shadow-lg shadow-amber-500/20 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, hsl(36 95% 50%), hsl(24 90% 45%))" }}
          >
            {saving ? "Linking..." : "Link Bank Account"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

/* ── Merchant Settlement Config Sheet ── */
const MerchantSettlementConfigSheet = ({ open, onClose, merchant }: { open: boolean; onClose: () => void; merchant: MerchantInfo | null }) => {
  const { toast } = useToast();
  const { t } = useI18n();
  const [frequency, setFrequency] = useState(merchant?.settlement_frequency || "T+1");
  const [customTime, setCustomTime] = useState("09:00");
  const [saving, setSaving] = useState(false);

  const freqOptions = [
    { id: "T+1", label: t("mscFreqT1Label"), desc: t("mscFreqT1Desc"), icon: Zap },
    { id: "T+2", label: t("mscFreqT2Label"), desc: t("mscFreqT2Desc"), icon: Calendar },
    { id: "Weekly", label: t("mscFreqWeeklyLabel"), desc: t("mscFreqWeeklyDesc"), icon: Repeat },
    { id: "Monthly", label: t("mscFreqMonthlyLabel"), desc: t("mscFreqMonthlyDesc"), icon: CalendarClock },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("merchants").update({
        settlement_frequency: frequency,
      }).eq("id", merchant?.id || "");
      if (error) throw error;
      toast({ title: t("mscToastUpdated"), description: t("mscToastUpdatedDesc").replace("{freq}", frequency).replace("{time}", customTime) });
      onClose();
    } catch (e: any) {
      toast({ title: t("mscToastFailed"), description: e.message || t("mscToastFailedDesc"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={onClose}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", bounce: 0.15 }}
        className="w-full max-w-xl bg-card rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-muted rounded-full mx-auto" />
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
            <CalendarClock size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">{t("mscTitle")}</h3>
            <p className="text-[11px] text-muted-foreground">{t("mscSubtitle")}</p>
          </div>
        </div>

        <div className="space-y-2">
          {freqOptions.map(opt => (
            <button key={opt.id} onClick={() => setFrequency(opt.id)}
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${frequency === opt.id ? "border-primary bg-primary/5 shadow-sm" : "border-border/50 hover:bg-muted/30"}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${frequency === opt.id ? "bg-primary/15" : "bg-muted/50"}`}>
                <opt.icon size={16} className={frequency === opt.id ? "text-primary" : "text-muted-foreground"} />
              </div>
              <div className="flex-1">
                <p className={`text-xs font-bold ${frequency === opt.id ? "text-primary" : "text-foreground"}`}>{opt.label}</p>
                <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
              </div>
              {frequency === opt.id && <CheckCircle2 size={16} className="text-primary" />}
            </button>
          ))}
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">{t("mscTimeLabel")}</label>
          <Input type="time" value={customTime} onChange={e => setCustomTime(e.target.value)} className="h-12 rounded-xl" />
          <p className="text-[9px] text-muted-foreground mt-1">{t("mscTimeHelp")}</p>
        </div>

        {merchant?.bank_name ? (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-2">
              <CheckCircle2 size={12} /> {t("mscBankLinked").replace("{bank}", merchant.bank_name).replace("{last4}", merchant.bank_account_number?.slice(-4) || "")}
            </p>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-[10px] text-amber-700 dark:text-amber-300 font-medium flex items-center gap-2">
              <Shield size={12} /> {t("mscBankMissing")}
            </p>
          </div>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-xl text-sm font-bold" style={{ background: "linear-gradient(135deg, hsl(270 60% 50%), hsl(280 55% 40%))" }}>
          {saving ? t("mscSaving") : t("mscSaveBtn")}
        </Button>
      </motion.div>
    </div>
  );
};


/* ── Merchant Floating Chat FAB ── */
const MerchantChatFAB = ({ userId, onOpenInbox }: { userId: string | null; onOpenInbox: () => void }) => {
  const [totalUnread, setTotalUnread] = useState(0);
  const { conversations } = useChat();

  useEffect(() => {
    if (!conversations) return;
    const unread = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
    setTotalUnread(unread);
  }, [conversations]);

  if (!userId) return null;

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.8 }}
      whileTap={{ scale: 0.9 }}
      onClick={() => onOpenInbox()}
      className="fixed bottom-6 right-4 z-[60] w-14 h-14 rounded-full shadow-lg flex items-center justify-center bg-primary text-primary-foreground"
    >
      <MessageCircle className="w-6 h-6" />
      {totalUnread > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1"
        >
          {totalUnread > 99 ? "99+" : totalUnread}
        </motion.span>
      )}
    </motion.button>
  );
};

export default MerchantDashboard;
